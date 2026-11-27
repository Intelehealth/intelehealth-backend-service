const { database, openMrsDatabase } = require('./index');

const PRIORITY_HIGH = 'high';
const PRIORITY_NORMAL = 'normal';

const STATUS_WAITING = 'waiting';
const STATUS_PROCESSING = 'processing';
const STATUS_DONE = 'done';
const STATUS_FAILED = 'failed';
const STATUS_REMOVED = 'removed';

const RESULT_DONE = 'done';

const QUEUEABLE_STATUSES = ['Awaiting Consult', 'Priority'];
const TERMINAL_STATUSES = ['Ended Visit', 'Completed Visit'];

const STUCK_PICKUP_MINUTES = Number(process.env.AI_DDX_STUCK_PICKUP_MINUTES || 15);
const MAX_ATTEMPTS = Number(process.env.AI_DDX_MAX_ATTEMPTS || 3);

const VISIT_STATUS_QUERY = `select
    t1.visit_id,
    t1.uuid,
    case
      when (ended = 1) then "Ended Visit"
        when (
            encounter_type = 14
            or encounter_type = 12
            or com_enc = 1
        ) then "Completed Visit"
        when (encounter_type = 9) then "Visit In Progress"
        when (encounter_type) = 15 then "Priority"
        when (
            (
                encounter_type = 1
                or encounter_type = 6
            )
        ) then "Awaiting Consult"
    end as "Status",
    t1.speciality
from
    encounter,
    (
        select
            v.visit_id,
            v.patient_id,
            v.uuid,
            max(encounter_id) as max_enc,
            max(
                case
                    when (encounter_type in (12, 14)) then 1
                    else 0
                end
            ) as com_enc,
            max(
                case
                    when attribute_type_id = 5 then value_reference
                    else null
                end
            ) as "speciality",
            max(
              case
                  when (v.date_stopped is not null) then 1
                  else 0
              end
          ) as ended
        from
            visit v
            LEFT JOIN encounter e on e.visit_id = v.visit_id and (e.encounter_type IN (1,6,9,12,14,15))
            LEFT JOIN visit_attribute va on (va.visit_id= v.visit_id and va.voided = 0 and va.attribute_type_id = 5)
        where
            v.voided = 0
            and e.voided = 0
        group by
            v.visit_id,
            v.patient_id
    ) as t1
where
    encounter_id = max_enc`;

const priorityFor = (status) => (status === 'Priority' ? PRIORITY_HIGH : PRIORITY_NORMAL);

const fetchVisitStatuses = async () => {
  const [rows] = await openMrsDatabase.query(VISIT_STATUS_QUERY);
  return {
    queueable: rows.filter((row) => QUEUEABLE_STATUSES.includes(row?.Status)),
    terminalUuids: rows
      .filter((row) => TERMINAL_STATUSES.includes(row?.Status))
      .map((row) => row?.uuid)
      .filter(Boolean),
  };
};

const fetchVisitMeta = async (visitIds) => {
  if (!visitIds.length) {
    return {};
  }
  const [rows] = await openMrsDatabase.query(
    'SELECT visit_id, uuid, date_created, patient_id FROM visit WHERE visit_id IN (:visitIds) AND voided = 0',
    { visitIds }
  );
  const patientIds = [...new Set(rows.map((r) => r.patient_id))];
  const [people] = patientIds.length
    ? await openMrsDatabase.query('SELECT person_id, uuid FROM person WHERE person_id IN (:patientIds)', {
        patientIds,
      })
    : [[]];
  const personUuidById = people.reduce((acc, p) => {
    acc[p.person_id] = p.uuid;
    return acc;
  }, {});

  return rows.reduce((acc, row) => {
    acc[row.visit_id] = {
      visit_created_at: row.date_created,
      patient_uuid: personUuidById[row.patient_id] || null,
    };
    return acc;
  }, {});
};

const insertFreshRows = async (rows) => {
  if (!rows.length) {
    return;
  }
  const columns = [
    'visit_uuid',
    'visit_id',
    'patient_uuid',
    'speciality',
    'priority',
    'status',
    'attempts',
    'visit_created_at',
    'createdAt',
    'updatedAt',
  ];
  const now = new Date();
  const valueGroups = [];
  const params = {};
  rows.forEach((row, index) => {
    const values = {
      visit_uuid: row.uuid,
      visit_id: row.visit_id,
      patient_uuid: row.patient_uuid,
      speciality: row.speciality,
      priority: row.priority,
      status: STATUS_WAITING,
      attempts: 0,
      visit_created_at: row.visit_created_at,
      createdAt: now,
      updatedAt: now,
    };
    valueGroups.push(`(${columns.map((col) => `:${col}${index}`).join(', ')})`);
    columns.forEach((col) => {
      params[`${col}${index}`] = values[col];
    });
  });
  await database.query(
    `INSERT IGNORE INTO visit_queue (${columns.join(', ')}) VALUES ${valueGroups.join(', ')}`,
    params
  );
};

const syncAwaitingVisits = async () => {
  const { queueable: visits, terminalUuids } = await fetchVisitStatuses();
  const candidates = visits.filter((row) => row?.uuid && row?.visit_id);
  const candidateUuids = candidates.map((row) => row.uuid);

  const [[queuedRows], [computedRows]] = await Promise.all([
    candidateUuids.length
      ? database.query('SELECT id, visit_uuid, priority FROM visit_queue WHERE visit_uuid IN (:uuids)', {
          uuids: candidateUuids,
        })
      : [[]],
    candidateUuids.length
      ? database.query(
          'SELECT visit_uuid FROM ai_ddx_results WHERE visit_uuid IN (:uuids) AND status = :status',
          { uuids: candidateUuids, status: RESULT_DONE }
        )
      : [[]],
  ]);

  const queuedByUuid = new Map(queuedRows.map((row) => [row.visit_uuid, row]));
  const alreadyComputed = new Set(computedRows.map((row) => row.visit_uuid));

  const fresh = candidates.filter(
    (row) => !queuedByUuid.has(row.uuid) && !alreadyComputed.has(row.uuid)
  );
  const meta = await fetchVisitMeta(fresh.map((v) => v.visit_id));

  let skippedComputed = 0;
  candidates.forEach((row) => {
    if (!queuedByUuid.has(row.uuid) && alreadyComputed.has(row.uuid)) {
      skippedComputed += 1;
    }
  });

  await insertFreshRows(
    fresh.map((row) => ({
      uuid: row.uuid,
      visit_id: row.visit_id,
      patient_uuid: meta[row.visit_id]?.patient_uuid || null,
      speciality: row.speciality || null,
      priority: priorityFor(row.Status),
      visit_created_at: meta[row.visit_id]?.visit_created_at || null,
    }))
  );

  let updated = 0;
  for (const row of candidates) {
    const existing = queuedByUuid.get(row.uuid);
    if (!existing) {
      continue;
    }
    const priority = priorityFor(row.Status);
    if (existing.priority !== priority) {
      await database.query('UPDATE visit_queue SET priority = :priority, updatedAt = :now WHERE id = :id', {
        priority,
        now: new Date(),
        id: existing.id,
      });
      updated += 1;
    }
  }

  let removed = 0;
  if (terminalUuids.length) {
    const [result] = await database.query(
      "UPDATE visit_queue SET status = 'removed', updatedAt = :now WHERE status = 'waiting' AND visit_uuid IN (:uuids)",
      { now: new Date(), uuids: terminalUuids }
    );
    removed = result.affectedRows;
  }

  return { added: fresh.length, updated, removed, skippedComputed, total: candidates.length };
};

const reclaimStuckRows = async () => {
  const cutoff = new Date(Date.now() - STUCK_PICKUP_MINUTES * 60 * 1000);
  const [result] = await database.query(
    "UPDATE visit_queue SET status = 'waiting', picked_at = NULL, updatedAt = :now WHERE status = 'processing' AND picked_at < :cutoff",
    { now: new Date(), cutoff }
  );
  return result.affectedRows;
};

const claimNext = async (limit = 5) => {
  await reclaimStuckRows();

  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT * FROM visit_queue
       WHERE status = :waiting AND attempts < :maxAttempts
       ORDER BY FIELD(priority, 'high', 'normal') ASC, visit_created_at ASC, id ASC
       LIMIT ${safeLimit}
       FOR UPDATE`,
      { waiting: STATUS_WAITING, maxAttempts: MAX_ATTEMPTS }
    );

    if (rows.length) {
      const ids = rows.map((r) => r.id);
      await connection.query(
        'UPDATE visit_queue SET status = :processing, picked_at = :now, updatedAt = :now WHERE id IN (:ids)',
        { processing: STATUS_PROCESSING, now: new Date(), ids }
      );
    }

    await connection.commit();
    return rows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const markDone = async (id) =>
  database.query('UPDATE visit_queue SET status = :status, updatedAt = :now WHERE id = :id', {
    status: STATUS_DONE,
    now: new Date(),
    id,
  });

const markFailed = async (id, attempts) => {
  const nextAttempts = (attempts || 0) + 1;
  return database.query(
    'UPDATE visit_queue SET status = :status, attempts = :attempts, picked_at = NULL, updatedAt = :now WHERE id = :id',
    {
      status: nextAttempts >= MAX_ATTEMPTS ? STATUS_FAILED : STATUS_WAITING,
      attempts: nextAttempts,
      now: new Date(),
      id,
    }
  );
};

module.exports = {
  syncAwaitingVisits,
  claimNext,
  markDone,
  markFailed,
  MAX_ATTEMPTS,
  STATUS_WAITING,
  STATUS_PROCESSING,
  STATUS_DONE,
  STATUS_FAILED,
  STATUS_REMOVED,
};
