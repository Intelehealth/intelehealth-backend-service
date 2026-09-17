const { Op } = require("sequelize");

const models = require("../models");
const config = require("../config/env");
const logger = require("../utils/logger");
const priority = require("./priority.service");
const priorityConfig = require("./priorityConfig.service");
const queueLane = require("./queueLane.service");
const etaService = require("./eta.service");
const doctorStatus = require("./doctorStatus.service");
const doctorAssignment = require("./doctorAssignment.service");
const notification = require("./notification.service");
const { assertTransition, canTransition } = require("../utils/stateMachine");
const { matchLevel } = require("../utils/speciality");
const {
  STATUS,
  WAITING_STATUSES,
  IN_SERVICE_STATUSES,
  TERMINAL_STATUSES,
  POST_CALL_STATUSES,
  DOCTOR_STATUS,
  EMERGENCY_LEVEL,
} = require("../constants");
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} = require("../utils/errors");

/**
 * Queue service — backend LLD §09, orchestrating the priority engine (§05),
 * doctor assignment (§06), wait-time estimation (§07) and the notification
 * tiering (§08).
 *
 * Every state change goes through the §04 state machine before it is written.
 * Every claim goes through a conditional UPDATE whose affected-row count is the
 * race verdict — never a read-then-write assumption.
 */

const MAX_DISPATCH_PER_PASS = 25;

const scopeOf = (entry) => ({ speciality: entry.speciality });

/**
 * LLD §09.1 — a stale heartbeat FLAGS an entry for review; it never cancels it,
 * because a patient may still be waiting even though the app died. Derived from
 * the timestamp rather than stored, so the flag cannot drift out of step with
 * the heartbeat it describes.
 */
const heartbeatStale = (entry, now = new Date()) => {
  if (!entry.lastHeartbeatAt) return false;
  const cutoff = now.getTime() - config.queue.heartbeatStaleMinutes * 60000;
  return new Date(entry.lastHeartbeatAt).getTime() < cutoff;
};

/**
 * How long a prescription has been outstanding, and whether that is overdue.
 *
 * Reporting only. A machine must never discharge a clinical obligation by
 * timing it out, so nothing acts on this — the ops view surfaces it and a human
 * chases it, the same principle as the heartbeat flag.
 */
const prescriptionOutstandingMinutes = (entry, now = new Date()) => {
  if (entry.status !== STATUS.CALL_COMPLETED || !entry.callEndedAt) return null;
  return Math.max(0, Math.round((now.getTime() - new Date(entry.callEndedAt).getTime()) / 60000));
};

const prescriptionOverdue = (entry, now = new Date()) => {
  const mins = prescriptionOutstandingMinutes(entry, now);
  return mins !== null && mins > config.queue.prescriptionOverdueMinutes;
};

/** The pre-assignment score, reproduced exactly rather than snapshotted. */
const restorableScore = (entry) =>
  Number(entry.baseScore || 0) + Number(entry.cumulativeAgingApplied || 0);

const findEntry = async (queueEntryId) => {
  const entry = await models.queue_entries.findByPk(queueEntryId);
  if (!entry) throw new NotFoundError(`No queue entry ${queueEntryId}`, "QUEUE_ENTRY_NOT_FOUND");
  return entry;
};

/** The shape every HW-facing endpoint returns. */
const statusPayload = async (entry, { includeEta = true } = {}) => {
  const waiting = WAITING_STATUSES.includes(entry.status);
  const position = waiting ? await queueLane.getPosition(entry) : null;

  let etaAt = entry.etaAt ?? null;
  let etaModel = entry.etaModelUsed ?? null;
  if (waiting && includeEta) {
    const estimate = await etaService.estimate(entry, { position });
    const anchor = etaService.resolveAnchor(
      { storedEtaAt: entry.etaAt, storedWaitMin: entry.estimatedWaitMin },
      estimate.etaMinutes
    );
    etaAt = anchor.etaAt;
    etaModel = estimate.model;
    // Persist a moved anchor so the next read — and the client's countdown —
    // agree with this one.
    if (anchor.moved) {
      await entry.update({
        etaAt,
        estimatedWaitMin: estimate.etaMinutes,
        etaModelUsed: estimate.model,
      });
    }
  }

  return {
    queueEntryId: entry.id,
    visitUuid: entry.visitUuid,
    patientUuid: entry.patientUuid,
    // The health worker who raised the visit. Stored since the first migration
    // and returned by /list, but it was missing from this payload — so submit,
    // status and the visit lookup all hid the one identifier a caller needs to
    // tie the case back to whoever created it.
    hwUserUuid: entry.hwUserUuid,
    locationUuid: entry.locationUuid,
    speciality: entry.speciality,
    status: entry.status,
    emergencyLevel: entry.emergencyLevel,
    caseType: entry.caseType,
    position,
    // The estimate as an absolute instant. A client renders its own countdown
    // from this and never needs a push just because a minute passed.
    etaAt: etaAt ? new Date(etaAt).toISOString() : null,
    // Derived from etaAt for convenience and for older clients. It is a
    // snapshot: etaAt is the value of record.
    etaMinutes: etaService.minutesUntil(etaAt),
    etaOverdue: etaService.isOverdue(etaAt),
    etaModelUsed: etaModel,
    assignedDoctorUuid: entry.assignedDoctorUuid,
    queuedAt: entry.queuedAt,
    assignedAt: entry.assignedAt,
    connectedAt: entry.connectedAt,
    completedAt: entry.completedAt,
    escalated: entry.escalatedAt !== null && entry.escalatedAt !== undefined,
    heartbeatStale: heartbeatStale(entry),
    callEndedAt: entry.callEndedAt,
    // The call is over but the visit is not: a prescription is still owed.
    prescriptionPending: entry.status === STATUS.CALL_COMPLETED,
    prescriptionOutstandingMinutes: prescriptionOutstandingMinutes(entry),
    prescriptionOverdue: prescriptionOverdue(entry),
  };
};

/**
 * Write the score and persist the ETA snapshot taken at enqueue time.
 * initial_estimated_wait_min is what /analytics/accuracy later compares against
 * the real wait (§09.4) — without it there is nothing to measure drift with.
 */
const stampInitialEstimate = async (entry) => {
  const position = await queueLane.getPosition(entry);
  const { etaMinutes, freshEtaAt, model } = await etaService.estimate(entry, { position });
  await entry.update({
    estimatedWaitMin: etaMinutes,
    initialEstimatedWaitMin: etaMinutes,
    etaAt: freshEtaAt,
    etaModelUsed: model,
  });
  return { position, etaMinutes, etaAt: freshEtaAt, model };
};

/**
 * Assign one already-selected case to one already-selected doctor.
 *
 * The conditional UPDATE is the whole race resolution (LLD §09.2): the WHERE
 * clause only matches while the case is still waiting, so exactly one caller
 * can ever get affectedRows = 1. Everyone else gets 0 and must be told the case
 * is gone — not handed a silent success.
 */
const assignCase = async (entry, doctorUuid, { source = "DISPATCH" } = {}) => {
  const [affected] = await models.queue_entries.update(
    {
      status: STATUS.ASSIGNED,
      assignedDoctorUuid: doctorUuid,
      assignedAt: new Date(),
    },
    { where: { id: entry.id, status: { [Op.in]: WAITING_STATUSES } } }
  );

  if (affected === 0) return null;

  await doctorStatus.setStatus(doctorUuid, DOCTOR_STATUS.IN_CONSULT, {
    speciality: entry.speciality,
    queueEntryId: entry.id,
  });

  await entry.reload();
  logger.info("Case assigned", { queueEntryId: entry.id, doctorUuid, source });

  // §08 — "go call getToken". Immediate, any tier.
  await notification.notifyReady(entry, { assignedDoctorUuid: doctorUuid });
  notification.scheduleLaneUpdate(scopeOf(entry));

  return entry;
};

/**
 * Case-first dispatch (Priority Engine §06).
 *
 * Pop the highest-priority waiting case for the lane, THEN score the doctors
 * eligible for that specific case. Never the other way round: picking the best
 * case per idle doctor would let a lower-priority case jump the line because it
 * happened to suit whoever was free.
 */
const dispatchLane = async (scope, { limit = MAX_DISPATCH_PER_PASS } = {}) => {
  const assigned = [];

  for (let i = 0; i < limit; i += 1) {
    const entry = await queueLane.peekNext(scope);
    if (!entry) break;

    const { doctor } = await doctorAssignment.selectDoctorFor(entry);
    if (!doctor) break; // nobody eligible — everything behind this case waits too

    const result = await assignCase(entry, doctor.doctorUuid, { source: "DISPATCH" });
    if (!result) continue; // lost the race for this case; try the next one
    assigned.push({ queueEntryId: result.id, doctorUuid: doctor.doctorUuid });
  }

  return assigned;
};

/**
 * POST /api/queue/submit — backend LLD §09.1.
 *
 * IDEMPOTENT ON visitUuid. A slow or flaky mobile connection means the app may
 * retry this call after a timeout even though the first attempt succeeded; if a
 * queue entry already exists for that visit we return its current status rather
 * than creating a second one. Otherwise a single visit ends up as two people in
 * the queue.
 */
const submit = async (input) => {
  const existing = await models.queue_entries.findOne({ where: { visitUuid: input.visitUuid } });
  if (existing) {
    logger.info("Submit deduped on visitUuid", {
      queueEntryId: existing.id,
      visitUuid: existing.visitUuid,
    });
    return {
      deduped: true,
      status: existing.status === STATUS.ASSIGNED ? "READY" : existing.status,
      entry: await statusPayload(existing),
    };
  }

  const cfg = priorityConfig.get();
  const specMatch = input.specMatch || matchLevel(input.speciality, input.speciality);
  const scored = priority.computeBaseScore(
    {
      emergencyLevel: input.emergencyLevel,
      caseType: input.caseType,
      specMatch,
      vitals: input.vitals,
      flagged: input.flagged,
    },
    cfg
  );

  const now = new Date();
  // Only what the service actually reads back is stored. specMatch, vitals and
  // the chief complaint are scoring inputs consumed above; the emergency level
  // they produced is kept, they are not. Clinical detail stays in OpenMRS.
  const entry = await models.queue_entries.create({
    visitUuid: input.visitUuid,
    patientUuid: input.patientUuid,
    hwUserUuid: input.hwUserUuid,
    locationUuid: input.locationUuid,
    speciality: input.speciality,
    emergencyLevel: scored.emergencyLevel,
    caseType: scored.caseType,
    flagged: Boolean(input.flagged),
    baseScore: scored.baseScore,
    priorityScore: scored.baseScore, // W(0) = 0
    cumulativeAgingApplied: 0,
    status: STATUS.QUEUED,
    queuedAt: now,
    lastHeartbeatAt: now,
  });

  await stampInitialEstimate(entry);

  // The case is in the line before anyone is chosen for it, so dispatch stays
  // case-first: if something ahead of it outranks it, that case is assigned and
  // this one waits — no queue-jumping just because a doctor happened to be free
  // at the moment of submission.
  const assigned = await dispatchLane(scopeOf(entry));
  await entry.reload();

  const wasAssigned = assigned.some((a) => a.queueEntryId === entry.id);

  if (!wasAssigned) {
    // The visit is waiting. Tell the health worker it landed, and tell every
    // doctor in the speciality that someone is waiting for them. Both are
    // one-shot and immediate — the §08 tiering damps repeated position churn,
    // which this is not.
    //
    // Skipped when the case was assigned on the spot: the health worker gets
    // queue:ready instead, and there is nothing for other doctors to pick up.
    const position = await queueLane.getPosition(entry);
    const depth = await queueLane.getLaneDepth(scopeOf(entry));

    await notification.notifyCaseQueued(entry, { position, etaAt: entry.etaAt });
    await notification.notifyDoctorsOfNewCase(entry, { waiting: depth.total });
  }

  notification.scheduleLaneUpdate(scopeOf(entry));

  return {
    deduped: false,
    status: wasAssigned ? "READY" : "QUEUED",
    entry: await statusPayload(entry),
  };
};

/** GET /api/queue/:id/status — tier 4 "pull on demand" and the resync path. */
const getStatus = async (queueEntryId) => statusPayload(await findEntry(queueEntryId));

/** DELETE /api/queue/:id — the HW withdraws the case. */
const cancel = async (queueEntryId, { reason = null, source = "HW" } = {}) => {
  const entry = await findEntry(queueEntryId);
  assertTransition(entry.status, STATUS.CANCELLED, { queueEntryId });

  const scope = scopeOf(entry);
  const releasedDoctor = entry.assignedDoctorUuid;

  // The reason is logged and travels in the notification; it is not a column.
  await entry.update({ status: STATUS.CANCELLED, completedAt: new Date() });

  if (releasedDoctor) {
    await doctorStatus.setStatus(releasedDoctor, DOCTOR_STATUS.ONLINE, {
      speciality: entry.speciality,
    });
  }

  await notification.notifyCancelled(entry, reason);
  notification.scheduleLaneUpdate(scope);
  logger.info("Case cancelled", { queueEntryId, source, reason });

  return statusPayload(entry);
};

/**
 * POST /api/queue/:id/heartbeat — keep-alive so an entry from a killed app
 * doesn't sit forever.
 *
 * Note what this deliberately does NOT do: a stale heartbeat flags the entry
 * for review, it never auto-cancels it. A patient may still be waiting even if
 * the app died (§09.1).
 */
const heartbeat = async (queueEntryId) => {
  const entry = await findEntry(queueEntryId);
  if (!WAITING_STATUSES.includes(entry.status) && entry.status !== STATUS.ASSIGNED) {
    throw new ConflictError(
      `Cannot heartbeat a case in status ${entry.status}`,
      "HEARTBEAT_NOT_APPLICABLE"
    );
  }
  await entry.update({ lastHeartbeatAt: new Date() });
  return statusPayload(entry);
};

/* ── Listing ─────────────────────────────────────────────────────────────── */

/** Named status groups accepted by the list endpoints. */
const STATUS_GROUPS = {
  // The queue proper: waiting to be seen.
  WAITING: WAITING_STATUSES,
  // Waiting, in a call, or finished calling but still owing a prescription —
  // i.e. every case that is not yet closed.
  ACTIVE: [...WAITING_STATUSES, ...IN_SERVICE_STATUSES, ...POST_CALL_STATUSES],
  // Just the cases whose call is done but whose prescription is not. Named for
  // the question rather than the status, so `?status=CALL_COMPLETED` still
  // works as a plain status filter and means the same thing.
  AWAITING_PRESCRIPTION: [...POST_CALL_STATUSES],
  ALL: Object.values(STATUS),
};

const laneKeyOf = (entry) => String(entry.speciality);

const resolveStatuses = (status) => {
  if (!status) return STATUS_GROUPS.WAITING;
  const upper = String(status).toUpperCase();
  if (STATUS_GROUPS[upper]) return STATUS_GROUPS[upper];

  const requested = upper
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = requested.filter((s) => !Object.values(STATUS).includes(s));
  if (unknown.length) {
    throw new BadRequestError(
      `Unknown status: ${unknown.join(", ")}. Use one of ${Object.values(STATUS).join(", ")} ` +
        `or a group: ${Object.keys(STATUS_GROUPS).join(", ")}`,
      "INVALID_STATUS"
    );
  }
  return requested;
};

/**
 * One queue item as the list endpoints return it.
 *
 * priorityScore is withheld unless explicitly asked for by an admin or an
 * internal service. Priority Engine §01 is explicit: "P is a sort key, not a
 * meaningful absolute number ... nothing should ever display a raw P value to a
 * doctor or in a report — expose position and EWT instead."
 */
/**
 * The anchor to report for a list row: the stored one, unless a fresh estimate
 * in this request moved it past the tolerance.
 */
const etaAtOf = (entry, eta) => {
  const anchor = eta
    ? etaService.resolveAnchor(
        { storedEtaAt: entry.etaAt, storedWaitMin: entry.estimatedWaitMin },
        eta.etaMinutes
      ).etaAt
    : entry.etaAt;
  return anchor ? new Date(anchor).toISOString() : null;
};

const toListItem = (entry, { position = null, eta = null, includeScore = false } = {}) => ({
  queueEntryId: entry.id,
  visitUuid: entry.visitUuid,
  patientUuid: entry.patientUuid,
  hwUserUuid: entry.hwUserUuid,
  locationUuid: entry.locationUuid,
  speciality: entry.speciality,
  status: entry.status,
  emergencyLevel: entry.emergencyLevel,
  caseType: entry.caseType,
  flagged: entry.flagged,
  escalated: entry.escalatedAt !== null && entry.escalatedAt !== undefined,
  escalatedAt: entry.escalatedAt,
  position,
  waitedMinutes: Math.round(priority.minutesWaited(entry)),
  etaAt: etaAtOf(entry, eta),
  etaMinutes: etaService.minutesUntil(etaAtOf(entry, eta)),
  etaOverdue: etaService.isOverdue(etaAtOf(entry, eta)),
  etaModelUsed: eta ? eta.model : entry.etaModelUsed,
  assignedDoctorUuid: entry.assignedDoctorUuid,
  heartbeatStale: heartbeatStale(entry),
  prescriptionPending: entry.status === STATUS.CALL_COMPLETED,
  prescriptionOutstandingMinutes: prescriptionOutstandingMinutes(entry),
  prescriptionOverdue: prescriptionOverdue(entry),
  queuedAt: entry.queuedAt,
  assignedAt: entry.assignedAt,
  completedAt: entry.completedAt,
  ...(includeScore ? { priorityScore: entry.priorityScore } : {}),
});

/**
 * GET /api/queue/list — every queue item, or one speciality's.
 *
 * Ordered by the same lane rules the queue is actually served in
 * (ESCALATED → CRITICAL → NORMAL, then by score, then FIFO), so the top of the
 * list is genuinely the next patient rather than merely the oldest.
 *
 * Positions are computed against the FULL lane, not the returned page — asking
 * for page 3 does not renumber anyone from 1.
 *
 * Access (LLD §13.1): admins and internal services see everything. Anyone else
 * is scoped to cases they submitted or are assigned to, so this endpoint cannot
 * become a way to read the whole patient list with an ordinary login.
 */
const listQueue = async (filters = {}, auth = null) => {
  const statuses = resolveStatuses(filters.status);
  const where = { status: { [Op.in]: statuses } };

  if (filters.speciality) where.speciality = filters.speciality;
  if (filters.locationUuid) where.locationUuid = filters.locationUuid;
  if (filters.emergencyLevel) where.emergencyLevel = filters.emergencyLevel;
  if (filters.caseType) where.caseType = filters.caseType;
  if (filters.hwUserUuid) where.hwUserUuid = filters.hwUserUuid;
  if (filters.doctorUuid) where.assignedDoctorUuid = filters.doctorUuid;
  if (filters.visitUuid) where.visitUuid = filters.visitUuid;
  if (filters.patientUuid) where.patientUuid = filters.patientUuid;
  // escalated is the presence of escalated_at, not a separate flag.
  if (filters.escalated !== undefined) {
    where.escalatedAt = filters.escalated ? { [Op.ne]: null } : null;
  }
  if (filters.flagged !== undefined) where.flagged = filters.flagged;
  if (filters.queuedFrom || filters.queuedTo) {
    where.queuedAt = {
      ...(filters.queuedFrom ? { [Op.gte]: new Date(filters.queuedFrom) } : {}),
      ...(filters.queuedTo ? { [Op.lte]: new Date(filters.queuedTo) } : {}),
    };
  }

  const privileged = Boolean(auth?.isAdmin || auth?.isService);
  if (auth && !privileged) {
    if (!auth.userUuid) {
      throw new ForbiddenError("No user identity on this token", "NO_IDENTITY");
    }
    where[Op.or] = [{ hwUserUuid: auth.userUuid }, { assignedDoctorUuid: auth.userUuid }];
  }

  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const SORTS = {
    priority: queueLane.listOrder(),
    queuedAt: [["queuedAt", "ASC"], ["id", "ASC"]],
    "-queuedAt": [["queuedAt", "DESC"], ["id", "DESC"]],
    waitedLongest: [["queuedAt", "ASC"], ["id", "ASC"]],
    // id is monotonic, so it is creation order without a column for it.
    recent: [["id", "DESC"]],
  };
  const sort = SORTS[filters.sort] ? filters.sort : "priority";

  const { rows, count } = await models.queue_entries.findAndCountAll({
    where,
    order: SORTS[sort],
    limit,
    offset,
  });

  // Positions come from a single walk of each lane the page touches, so a
  // 50-item page costs a handful of queries rather than 50 counts.
  const positionById = new Map();
  const waiting = rows.filter((row) => WAITING_STATUSES.includes(row.status));
  const scopes = new Map();
  for (const row of waiting) scopes.set(laneKeyOf(row), scopeOf(row));
  for (const scope of scopes.values()) {
    const ranks = await queueLane.rankMap(scope);
    for (const [id, position] of ranks) positionById.set(id, position);
  }

  const etaById = filters.includeEta === false
    ? new Map()
    : await etaService.estimateMany(waiting, positionById);

  const includeScore = Boolean(filters.includeScore) && privileged;

  return {
    items: rows.map((row) =>
      toListItem(row, {
        position: positionById.get(row.id) ?? null,
        eta: etaById.get(row.id) || null,
        includeScore,
      })
    ),
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
    appliedFilters: {
      status: statuses,
      speciality: filters.speciality || null,
      locationUuid: filters.locationUuid || null,
      sort,
      scopedToCaller: Boolean(auth && !privileged),
    },
  };
};

/**
 * GET /api/queue/specialities — speciality-wise counts, one row per lane.
 *
 * The "how many are pending in each speciality" view. Distinct from
 * /analytics/live, which is the ops dashboard (doctor presence, utilisation);
 * this one is purely queue-side and cheap enough to poll.
 *
 * `withItems` attaches the top N cases per speciality so a dashboard can render
 * counts and a preview in one round trip.
 */
const specialitySummary = async (filters = {}, auth = null) => {
  const statuses = resolveStatuses(filters.status || "ACTIVE");
  const where = { status: { [Op.in]: statuses } };
  if (filters.speciality) where.speciality = filters.speciality;
  if (filters.locationUuid) where.locationUuid = filters.locationUuid;

  const privileged = Boolean(auth?.isAdmin || auth?.isService);
  if (auth && !privileged) {
    if (!auth.userUuid) {
      throw new ForbiddenError("No user identity on this token", "NO_IDENTITY");
    }
    where[Op.or] = [{ hwUserUuid: auth.userUuid }, { assignedDoctorUuid: auth.userUuid }];
  }

  const rows = await models.queue_entries.findAll({
    where,
    order: queueLane.listOrder(),
  });

  const now = new Date();
  const buckets = new Map();

  for (const row of rows) {
    const key = laneKeyOf(row);
    if (!buckets.has(key)) {
      buckets.set(key, {
        speciality: row.speciality,
        waiting: 0,
        escalated: 0,
        critical: 0,
        flagged: 0,
        heartbeatStale: 0,
        inService: 0,
        longestWaitMin: 0,
        oldestQueuedAt: null,
        _waitSum: 0,
        _etaSum: 0,
        _etaCount: 0,
        _rows: [],
      });
    }

    const bucket = buckets.get(key);
    if (WAITING_STATUSES.includes(row.status)) {
      bucket.waiting += 1;
      if (row.escalatedAt) bucket.escalated += 1;
      if (row.emergencyLevel === EMERGENCY_LEVEL.CRITICAL) bucket.critical += 1;
      if (row.flagged) bucket.flagged += 1;
      if (heartbeatStale(row, now)) bucket.heartbeatStale += 1;

      const waited = priority.minutesWaited(row, now);
      bucket._waitSum += waited;
      bucket.longestWaitMin = Math.max(bucket.longestWaitMin, Math.round(waited));
      if (!bucket.oldestQueuedAt || (row.queuedAt && row.queuedAt < bucket.oldestQueuedAt)) {
        bucket.oldestQueuedAt = row.queuedAt;
      }
      if (Number.isFinite(row.estimatedWaitMin)) {
        bucket._etaSum += row.estimatedWaitMin;
        bucket._etaCount += 1;
      }
      bucket._rows.push(row);
    } else {
      bucket.inService += 1;
    }
  }

  const itemsPerSpeciality = Math.min(Math.max(Number(filters.itemsPerSpeciality) || 5, 1), 25);

  const specialities = [];
  for (const bucket of buckets.values()) {
    const { _waitSum, _etaSum, _etaCount, _rows, ...clean } = bucket;
    clean.averageWaitMin = bucket.waiting ? Math.round(_waitSum / bucket.waiting) : 0;
    clean.averageEtaMin = _etaCount ? Math.round(_etaSum / _etaCount) : null;

    if (filters.withItems) {
      const top = _rows.slice(0, itemsPerSpeciality);
      const positions = await queueLane.rankMap(scopeOf(top[0] || { speciality: clean.speciality }));
      clean.items = top.map((row) =>
        toListItem(row, { position: positions.get(row.id) ?? null })
      );
    }

    specialities.push(clean);
  }

  specialities.sort((a, b) => b.waiting - a.waiting || a.speciality.localeCompare(b.speciality));

  return {
    generatedAt: now.toISOString(),
    totals: {
      waiting: specialities.reduce((sum, s) => sum + s.waiting, 0),
      inService: specialities.reduce((sum, s) => sum + s.inService, 0),
      escalated: specialities.reduce((sum, s) => sum + s.escalated, 0),
      critical: specialities.reduce((sum, s) => sum + s.critical, 0),
      specialities: specialities.length,
    },
    appliedFilters: {
      status: statuses,
      speciality: filters.speciality || null,
      locationUuid: filters.locationUuid || null,
      scopedToCaller: Boolean(auth && !privileged),
    },
    specialities,
  };
};

/**
 * GET /api/queue/doctor/:doctorUuid/list — the doctor panel.
 * Merges the critical lane with the doctor's speciality lane (LLD §09.2).
 */
const listForDoctor = async (doctorUuid, { speciality, limit = 50, offset = 0 } = {}) => {
  let resolvedSpeciality = speciality;
  if (!resolvedSpeciality) {
    const status = await doctorStatus.getStatus(doctorUuid);
    resolvedSpeciality = status?.speciality;
  }
  if (!resolvedSpeciality) {
    throw new BadRequestError(
      "speciality is required (no stored status for this doctor yet)",
      "SPECIALITY_REQUIRED"
    );
  }

  const scope = { speciality: resolvedSpeciality };
  const { rows, total } = await queueLane.listLane(scope, { limit, offset });

  const cases = await Promise.all(
    rows.map(async (entry, index) => ({
      queueEntryId: entry.id,
      visitUuid: entry.visitUuid,
      patientUuid: entry.patientUuid,
      speciality: entry.speciality,
      emergencyLevel: entry.emergencyLevel,
      caseType: entry.caseType,
      flagged: entry.flagged,
      escalated: entry.escalatedAt !== null,
      status: entry.status,
      position: offset + index + 1,
      waitedMinutes: Math.round(priority.minutesWaited(entry)),
      etaAt: entry.etaAt ? new Date(entry.etaAt).toISOString() : null,
      etaMinutes: etaService.minutesUntil(entry.etaAt),
      queuedAt: entry.queuedAt,
    }))
  );

  return { cases, total, speciality: resolvedSpeciality };
};

/**
 * POST /api/queue/:id/claim — a doctor picks a specific case off the panel.
 *
 * Two doctors can click the same case within the same second. This has to
 * resolve to exactly one winner: the conditional UPDATE below only matches
 * while the case is still waiting, so the first request through gets
 * affectedRows = 1 and proceeds, and the second gets 0 and is told the case was
 * just claimed by someone else. The risk if that branch is skipped is two
 * doctors both being told they got the same patient (LLD §09.2).
 *
 * This endpoint does NOT call web-rtc. The client calls getToken itself.
 */
const claim = async (queueEntryId, doctorUuid) => {
  const entry = await findEntry(queueEntryId);
  assertTransition(entry.status, STATUS.ASSIGNED, { queueEntryId });

  const assigned = await assignCase(entry, doctorUuid, { source: "CLAIM" });
  if (!assigned) {
    await entry.reload();
    if (entry.status === STATUS.CANCELLED) {
      throw new ConflictError("This case was cancelled", "CASE_CANCELLED", { queueEntryId });
    }
    throw new ConflictError(
      "This case was just claimed by another doctor",
      "CASE_ALREADY_CLAIMED",
      { queueEntryId, assignedDoctorUuid: entry.assignedDoctorUuid }
    );
  }

  return statusPayload(assigned);
};

/**
 * POST /api/queue/doctor/:doctorUuid/next — "give me the next patient".
 *
 * Uses SELECT ... FOR UPDATE SKIP LOCKED inside a managed transaction so two
 * doctors asking at the same instant are handed two different cases rather than
 * contending for one. Requires MySQL 8.0.1+; on older servers the conditional
 * UPDATE in assignCase is still the correctness guarantee, the lock is the
 * efficiency win.
 */
const claimNext = async (doctorUuid, { speciality } = {}) => {
  let resolvedSpeciality = speciality;
  if (!resolvedSpeciality) {
    const status = await doctorStatus.getStatus(doctorUuid);
    resolvedSpeciality = status?.speciality;
  }
  if (!resolvedSpeciality) {
    throw new BadRequestError("speciality is required", "SPECIALITY_REQUIRED");
  }

  const scope = { speciality: resolvedSpeciality };

  const picked = await models.sequelize.transaction(async (transaction) => {
    const next = await queueLane.peekNext(scope, { transaction, lock: true });
    if (!next) return null;
    return next.id;
  });

  if (!picked) return null;

  const entry = await findEntry(picked);
  const assigned = await assignCase(entry, doctorUuid, { source: "NEXT" });
  if (!assigned) return null; // raced away between the lock release and the write
  return statusPayload(assigned);
};

/**
 * POST /api/queue/:id/release — the doctor hands the case back (wrong
 * speciality picked up by mistake, etc).
 *
 * Re-added at its prior score — explicitly not penalised (LLD §09.2).
 */
const release = async (queueEntryId, doctorUuid, { reason = null } = {}) => {
  const entry = await findEntry(queueEntryId);
  // A case that had already breached its SLA goes back to the front where it
  // was, not to the back of the normal lane — releasing it was the doctor's
  // correction, not the patient's fault. Everything else returns as RE_QUEUED:
  // in this lifecycle that is the waiting state a handed-back case occupies,
  // and QUEUED is not reachable from ASSIGNED.
  const returnStatus = entry.escalatedAt ? STATUS.ESCALATED : STATUS.RE_QUEUED;
  assertTransition(entry.status, returnStatus, { queueEntryId });

  const restoredScore = restorableScore(entry);

  const [affected] = await models.queue_entries.update(
    {
      status: returnStatus,
      assignedDoctorUuid: null,
      assignedAt: null,
      priorityScore: restoredScore,
    },
    { where: { id: entry.id, status: STATUS.ASSIGNED, assignedDoctorUuid: doctorUuid } }
  );

  if (affected === 0) {
    await entry.reload();
    throw new ConflictError(
      "This case is no longer assigned to you",
      "CASE_NOT_ASSIGNED_TO_YOU",
      { queueEntryId, status: entry.status, assignedDoctorUuid: entry.assignedDoctorUuid }
    );
  }

  await doctorStatus.setStatus(doctorUuid, DOCTOR_STATUS.ONLINE, { speciality: entry.speciality });
  await entry.reload();
  notification.scheduleLaneUpdate(scopeOf(entry));
  logger.info("Case released", { queueEntryId, doctorUuid, reason });

  return statusPayload(entry);
};

/**
 * Find the queue entry for an OpenMRS visit.
 *
 * web-rtc knows a call by its visit, never by our queue_entry id, so the
 * call-lifecycle webhooks are addressed by visitUuid.
 */
const findByVisit = async (visitUuid) => {
  const entry = await models.queue_entries.findOne({ where: { visitUuid } });
  if (!entry) {
    throw new NotFoundError(`No queue entry for visit ${visitUuid}`, "QUEUE_ENTRY_NOT_FOUND");
  }
  return entry;
};

/* ── Call lifecycle webhooks (driven by web-rtc) ─────────────────────────────
 *
 * These exist because a webhook is not a well-behaved API client. Two things
 * follow from that, and both are handled here rather than pushed onto the
 * caller:
 *
 *  1. IDEMPOTENCY. Webhooks retry, and LiveKit can emit the same room event
 *     more than once. Re-delivering "connected" for a case that is already
 *     CONNECTED must be a no-op, not a 409 — otherwise a retry storm turns into
 *     an error storm and the real signal is lost.
 *
 *  2. NO "CONNECTING" EVENT EXISTS. The §04 state machine routes
 *     ASSIGNED → CONNECTING → CONNECTED, but LiveKit only ever tells us a
 *     participant joined. So the connect handler walks the intermediate step
 *     itself instead of rejecting the transition.
 */

/**
 * The call connected — a participant actually joined the room.
 * ASSIGNED cases are walked through CONNECTING so the §04 machine stays intact.
 */
const handleCallConnected = async (visitUuid, { doctorUuid = null } = {}) => {
  const entry = await findByVisit(visitUuid);

  if (entry.status === STATUS.CALL_CONNECTED) {
    logger.debug("Call-connected webhook re-delivered — already connected", {
      queueEntryId: entry.id,
    });
    return { changed: false, entry: await statusPayload(entry) };
  }

  if (entry.status === STATUS.ASSIGNED) {
    await entry.update({ status: STATUS.CALL_CONNECTING });
  }

  assertTransition(entry.status, STATUS.CALL_CONNECTED, { visitUuid });
  await entry.update({
    status: STATUS.CALL_CONNECTED,
    connectedAt: entry.connectedAt || new Date(),
    ...(doctorUuid && !entry.assignedDoctorUuid ? { assignedDoctorUuid: doctorUuid } : {}),
  });

  logger.info("Call connected", { queueEntryId: entry.id, visitUuid });
  return { changed: true, entry: await statusPayload(entry) };
};

/**
 * The call ended — the room finished or the last participant left.
 *
 * What that means depends on whether the call ever got going:
 *   CONNECTED             → COMPLETED, and the consult duration feeds μ (§07)
 *   ASSIGNED / CONNECTING → the call never established, so RE_QUEUED with a
 *                           priority bump (§04) rather than counted as done
 *   already terminal      → no-op, so a retried webhook is harmless
 */
const handleCallDisconnected = async (visitUuid, { doctorUuid = null, reason = null } = {}) => {
  const entry = await findByVisit(visitUuid);
  const doctor = doctorUuid || entry.assignedDoctorUuid;

  if (TERMINAL_STATUSES.includes(entry.status)) {
    logger.debug("Call-disconnected webhook re-delivered — already terminal", {
      queueEntryId: entry.id,
      status: entry.status,
    });
    return { changed: false, outcome: entry.status, entry: await statusPayload(entry) };
  }

  if (entry.status === STATUS.CALL_CONNECTED) {
    // complete() decides where this lands: CALL_COMPLETED when a
    // prescription is required, PRESCRIPTION_COMPLETED when it is not.
    const payload = await complete(entry.id, doctor, { source: "WEBRTC_WEBHOOK" });
    return { changed: true, outcome: payload.status, entry: payload };
  }

  if (entry.status === STATUS.ASSIGNED || entry.status === STATUS.CALL_CONNECTING) {
    // The room closed without the call ever connecting — that is a failed
    // attempt, not a finished consultation.
    return {
      changed: true,
      outcome: STATUS.RE_QUEUED,
      entry: await requeue(entry.id, { reason: reason || "CALL_ENDED_BEFORE_CONNECT" }),
    };
  }

  // Waiting, back in the queue, or already past the call and awaiting a
  // prescription: nothing for a disconnect to do.
  logger.debug("Call-disconnected webhook for a case that is not in a call", {
    queueEntryId: entry.id,
    status: entry.status,
  });
  return { changed: false, outcome: entry.status, entry: await statusPayload(entry) };
};

/** The web-rtc call-start hook: the room has been requested. */
const markConnecting = async (queueEntryId) => {
  const entry = await findEntry(queueEntryId);
  assertTransition(entry.status, STATUS.CALL_CONNECTING, { queueEntryId });
  await entry.update({ status: STATUS.CALL_CONNECTING });
  return statusPayload(entry);
};

/** The web-rtc call-start hook: media is flowing. */
const markConnected = async (queueEntryId) => {
  const entry = await findEntry(queueEntryId);
  assertTransition(entry.status, STATUS.CALL_CONNECTED, { queueEntryId });
  await entry.update({ status: STATUS.CALL_CONNECTED, connectedAt: new Date() });
  return statusPayload(entry);
};

/**
 * Fold one completed consultation into doctor_service_stats.avg_consult_min.
 * This EMA is μ in the wait-time formula (§07) — the only thing that keeps the
 * estimate tracking real doctor behaviour as it drifts.
 */
const updateConsultStats = async (doctorUuid, speciality, durationMin) => {
  if (!doctorUuid || !Number.isFinite(durationMin) || durationMin <= 0) return;

  const alpha = config.queue.consultEmaAlpha;
  const [stats] = await models.doctor_service_stats.findOrCreate({
    where: { doctorUuid },
    defaults: {
      doctorUuid,
      speciality,
      avgConsultMin: durationMin,
      consultCount: 1,
    },
  });

  if (stats.consultCount === 1 && stats.avgConsultMin === durationMin) return; // just created

  const previous = Number(stats.avgConsultMin);
  const next = Number.isFinite(previous) ? alpha * durationMin + (1 - alpha) * previous : durationMin;
  await stats.update({
    avgConsultMin: next,
    consultCount: stats.consultCount + 1,
    speciality: speciality || stats.speciality,
  });
};

/**
 * The call has ended. Shared by every path that ends one.
 *
 * TWO THINGS HAPPEN HERE AND NOWHERE ELSE, and both are about the call rather
 * than the visit:
 *
 *  1. The consult duration feeds doctor_service_stats.avg_consult_min — μ in
 *     the §07 wait estimate. It is measured connected -> call ended. It CANNOT
 *     be measured to completed_at any more: once a prescription gates
 *     completion, that gap includes however long the doctor took to write it,
 *     and folding that into μ would inflate every ETA in the speciality.
 *
 *  2. The doctor is freed and the lane is dispatched. A doctor who has finished
 *     talking to a patient is available for the next one; making them wait on
 *     their own paperwork would let one forgotten prescription stall the lane.
 *
 * Where the case lands afterwards is the caller's business — CALL_COMPLETED
 * when a prescription is required, PRESCRIPTION_COMPLETED when it is not.
 */
const finishCall = async (entry, doctorUuid, { now = new Date() } = {}) => {
  // Measured from connected_at only. A case that is closed out without a call
  // ever connecting — an asynchronous consultation, where the doctor writes the
  // prescription straight from the notes — has no consult duration to report,
  // and timing it from assigned_at would feed the wait before the call into μ
  // as though it were time spent with the patient.
  const durationMin = entry.connectedAt
    ? (now.getTime() - new Date(entry.connectedAt).getTime()) / 60000
    : null;
  const doctor = doctorUuid || entry.assignedDoctorUuid;

  if (doctor) {
    // updateConsultStats ignores a non-finite duration, so a call that never
    // connected frees the doctor without touching the EMA.
    await updateConsultStats(doctor, entry.speciality, durationMin);
    await doctorStatus.setStatus(doctor, DOCTOR_STATUS.ONLINE, { speciality: entry.speciality });
  }

  return { doctor, durationMin };
};

/**
 * POST /api/queue/:id/complete — the call is over.
 *
 * With REQUIRE_PRESCRIPTION_TO_COMPLETE on, this does NOT finish the visit: it
 * moves the case to CALL_COMPLETED, because a finished call is not a
 * finished consultation while the doctor still owes a prescription. Only
 * POST /prescription-shared closes it.
 *
 * With the flag off, behaviour is unchanged and the case completes here.
 */
const complete = async (queueEntryId, doctorUuid, { source = "DOCTOR" } = {}) => {
  const entry = await findEntry(queueEntryId);

  const gated = config.queue.requirePrescriptionToComplete;
  // A case already past the call (CALL_COMPLETED) is being closed out by
  // the prescription, not ending a call, so it must not re-feed the EMA.
  const endingACall = entry.status !== STATUS.CALL_COMPLETED;
  const target = gated && endingACall ? STATUS.CALL_COMPLETED : STATUS.PRESCRIPTION_COMPLETED;

  assertTransition(entry.status, target, { queueEntryId });

  const now = new Date();
  let durationMin = null;
  let doctor = doctorUuid || entry.assignedDoctorUuid;

  if (endingACall) {
    const finished = await finishCall(entry, doctorUuid, { now });
    doctor = finished.doctor;
    durationMin = finished.durationMin;
  }

  await entry.update(
    target === STATUS.CALL_COMPLETED
      ? { status: STATUS.CALL_COMPLETED, callEndedAt: entry.callEndedAt || now }
      : {
          status: STATUS.PRESCRIPTION_COMPLETED,
          completedAt: now,
          callEndedAt: entry.callEndedAt || (endingACall ? now : null),
        }
  );

  logger.info(
    target === STATUS.CALL_COMPLETED
      ? "Call ended — awaiting prescription"
      : "Case completed",
    { queueEntryId, doctorUuid: doctor, durationMin, source }
  );

  if (endingACall) {
    // A doctor just became free — the trigger for case-first dispatch of
    // whatever is now at the front of the lane.
    await dispatchLane(scopeOf(entry));
    notification.scheduleLaneUpdate(scopeOf(entry));
  }

  return statusPayload(entry);
};

/**
 * POST /api/queue/visit/:visitUuid/prescription-shared — the visit is done.
 *
 * Called by whoever knows the moment a prescription was shared (portal, or the
 * doctor webapp). QMS never queries OpenMRS itself, so it is told rather than
 * asking — the same arrangement as the web-rtc call webhooks.
 *
 * Idempotent: a case already COMPLETED reports changed:false rather than
 * erroring, so a retried call is harmless.
 */
const sharePrescription = async (visitUuid, { doctorUuid = null } = {}) => {
  const entry = await findByVisit(visitUuid);

  if (entry.status === STATUS.PRESCRIPTION_COMPLETED) {
    logger.debug("Prescription-shared re-delivered — already completed", {
      queueEntryId: entry.id,
    });
    return { changed: false, entry: await statusPayload(entry) };
  }

  if (!canTransition(entry.status, STATUS.PRESCRIPTION_COMPLETED)) {
    // A case still waiting in the queue, or already cancelled, has no
    // consultation to write a prescription for. That is a real conflict, not
    // something to paper over: the two systems disagree about where this visit
    // is, and silently completing it would lose a patient from the line.
    throw new ConflictError(
      `Cannot complete a case in status ${entry.status} — it has no consultation to prescribe from`,
      "NOT_AWAITING_PRESCRIPTION",
      { visitUuid, status: entry.status }
    );
  }

  const now = new Date();
  const outstanding = prescriptionOutstandingMinutes(entry);

  // The prescription may arrive while the doctor is still holding the case —
  // an asynchronous consultation (ASSIGNED straight to done), or a doctor who
  // writes it before the room closes. Those paths end the call here, so the
  // doctor is freed and the lane moves; a case already in CALL_COMPLETED was
  // freed when its call ended and must not be counted a second time.
  const stillHoldingTheCase = IN_SERVICE_STATUSES.includes(entry.status);
  if (stillHoldingTheCase) await finishCall(entry, doctorUuid, { now });

  await entry.update({
    status: STATUS.PRESCRIPTION_COMPLETED,
    completedAt: now,
    callEndedAt: entry.callEndedAt || (entry.connectedAt ? now : null),
  });

  logger.info("Prescription shared — visit completed", {
    queueEntryId: entry.id,
    visitUuid,
    doctorUuid: doctorUuid || entry.assignedDoctorUuid,
    outstandingMinutes: outstanding,
    endedCall: stillHoldingTheCase,
  });

  if (stillHoldingTheCase) {
    await dispatchLane(scopeOf(entry));
    notification.scheduleLaneUpdate(scopeOf(entry));
  }

  return { changed: true, entry: await statusPayload(entry) };
};

/**
 * Connection failed or timed out — LLD §04's RE_QUEUED state: back in the line
 * with a priority bump so a patient whose call keeps dropping does not slide
 * down it each time.
 *
 * The case now STAYS in RE_QUEUED rather than being moved straight back to
 * QUEUED. It is a waiting state a doctor is assigned out of, and keeping it
 * means "this patient has already had an attempt fail" survives in the record
 * instead of being erased on the way back into the queue.
 */
const requeue = async (queueEntryId, { reason = "CONNECTION_FAILED" } = {}) => {
  const entry = await findEntry(queueEntryId);
  // A case that had already breached its SLA returns to the front where it was:
  // the failed call was not the patient's fault, and dropping it into the
  // normal lane would make it serve its starvation wait twice.
  const returnStatus = entry.escalatedAt ? STATUS.ESCALATED : STATUS.RE_QUEUED;
  assertTransition(entry.status, returnStatus, { queueEntryId });

  const doctorUuid = entry.assignedDoctorUuid;
  const bumped = restorableScore(entry) + config.queue.requeueBonus;

  await entry.update({
    status: returnStatus,
    assignedDoctorUuid: null,
    assignedAt: null,
    connectedAt: null,
    priorityScore: bumped,
    // The bump belongs to the base, not to aging: the aging job must keep
    // applying W(m) against the same queued_at without erasing the bump.
    baseScore: entry.baseScore + config.queue.requeueBonus,
  });

  if (doctorUuid) {
    await doctorStatus.setStatus(doctorUuid, DOCTOR_STATUS.ONLINE, { speciality: entry.speciality });
  }

  notification.scheduleLaneUpdate(scopeOf(entry));
  logger.info("Case re-queued", { queueEntryId, reason });

  return statusPayload(entry);
};

module.exports = {
  submit,
  getStatus,
  cancel,
  heartbeat,
  listQueue,
  specialitySummary,
  listForDoctor,
  toListItem,
  STATUS_GROUPS,
  claim,
  claimNext,
  release,
  complete,
  requeue,
  markConnecting,
  markConnected,
  findByVisit,
  handleCallConnected,
  handleCallDisconnected,
  dispatchLane,
  assignCase,
  statusPayload,
  findEntry,
  updateConsultStats,
  scopeOf,
  heartbeatStale,
  restorableScore,
  sharePrescription,
  prescriptionOutstandingMinutes,
  prescriptionOverdue,
};
