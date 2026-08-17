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
const { assertTransition } = require("../utils/stateMachine");
const { matchLevel } = require("../utils/speciality");
const {
  STATUS,
  WAITING_STATUSES,
  IN_SERVICE_STATUSES,
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

const scopeOf = (entry) => ({
  speciality: entry.speciality,
  locationUuid: entry.locationUuid,
});

const findEntry = async (queueEntryId) => {
  const entry = await models.queue_entries.findByPk(queueEntryId);
  if (!entry) throw new NotFoundError(`No queue entry ${queueEntryId}`, "QUEUE_ENTRY_NOT_FOUND");
  return entry;
};

/** The shape every HW-facing endpoint returns. */
const statusPayload = async (entry, { includeEta = true } = {}) => {
  const waiting = WAITING_STATUSES.includes(entry.status);
  const position = waiting ? await queueLane.getPosition(entry) : null;

  let etaMinutes = entry.estimatedWaitMin ?? null;
  let etaModel = entry.etaModelUsed ?? null;
  if (waiting && includeEta) {
    const estimate = await etaService.estimate(entry, { position });
    etaMinutes = estimate.etaMinutes;
    etaModel = estimate.model;
  }

  return {
    queueEntryId: entry.id,
    visitUuid: entry.visitUuid,
    speciality: entry.speciality,
    status: entry.status,
    emergencyLevel: entry.emergencyLevel,
    caseType: entry.caseType,
    escalated: entry.escalated,
    position,
    etaMinutes,
    etaModelUsed: etaModel,
    assignedDoctorUuid: entry.assignedDoctorUuid,
    queuedAt: entry.queuedAt,
    assignedAt: entry.assignedAt,
    connectedAt: entry.connectedAt,
    completedAt: entry.completedAt,
    requeueCount: entry.requeueCount,
    heartbeatFlagged: entry.heartbeatFlagged,
  };
};

/**
 * Write the score and persist the ETA snapshot taken at enqueue time.
 * initial_estimated_wait_min is what /analytics/accuracy later compares against
 * the real wait (§09.4) — without it there is nothing to measure drift with.
 */
const stampInitialEstimate = async (entry) => {
  const position = await queueLane.getPosition(entry);
  const { etaMinutes, model } = await etaService.estimate(entry, { position });
  await entry.update({
    initialPosition: position,
    estimatedWaitMin: etaMinutes,
    initialEstimatedWaitMin: etaMinutes,
    etaModelUsed: model,
  });
  return { position, etaMinutes, model };
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
  const finalPosition = await queueLane.getPosition(entry);

  const [affected] = await models.queue_entries.update(
    {
      status: STATUS.ASSIGNED,
      assignedDoctorUuid: doctorUuid,
      assignedAt: new Date(),
      scoreBeforeAssignment: entry.priorityScore,
      finalPosition,
    },
    { where: { id: entry.id, status: { [Op.in]: WAITING_STATUSES } } }
  );

  if (affected === 0) return null;

  await doctorStatus.setStatus(doctorUuid, DOCTOR_STATUS.IN_CONSULT, {
    speciality: entry.speciality,
    queueEntryId: entry.id,
  });

  await entry.reload();
  logger.info("Case assigned", { queueEntryId: entry.id, doctorUuid, source, finalPosition });

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
  const entry = await models.queue_entries.create({
    visitUuid: input.visitUuid,
    patientUuid: input.patientUuid || null,
    hwUserUuid: input.hwUserUuid,
    speciality: input.speciality,
    locationUuid: input.locationUuid || null,
    emergencyLevel: scored.emergencyLevel,
    requestedEmergencyLevel: input.emergencyLevel || EMERGENCY_LEVEL.LOW,
    caseType: scored.caseType,
    specMatch: scored.specMatch,
    flagged: Boolean(input.flagged),
    vitals: input.vitals || null,
    chiefComplaint: input.chiefComplaint || null,
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

  notification.scheduleLaneUpdate(scopeOf(entry));

  const wasAssigned = assigned.some((a) => a.queueEntryId === entry.id);
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

  await entry.update({
    status: STATUS.CANCELLED,
    cancellationReason: reason,
    completionSource: source,
    completedAt: new Date(),
  });

  if (releasedDoctor) {
    await doctorStatus.setStatus(releasedDoctor, DOCTOR_STATUS.ONLINE, {
      speciality: entry.speciality,
    });
  }

  await notification.notifyCancelled(entry, reason);
  notification.scheduleLaneUpdate(scope);
  logger.info("Case cancelled", { queueEntryId, source });

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
  await entry.update({ lastHeartbeatAt: new Date(), heartbeatFlagged: false });
  return statusPayload(entry);
};

/* ── Listing ─────────────────────────────────────────────────────────────── */

/** Named status groups accepted by the list endpoints. */
const STATUS_GROUPS = {
  // The queue proper: waiting to be seen.
  WAITING: WAITING_STATUSES,
  // Waiting plus everything a doctor currently has in hand.
  ACTIVE: [...WAITING_STATUSES, ...IN_SERVICE_STATUSES],
  ALL: Object.values(STATUS),
};

const laneKeyOf = (entry) =>
  config.queue.scope === "SPECIALITY_LOCATION"
    ? `${entry.speciality}::${entry.locationUuid || ""}`
    : String(entry.speciality);

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
const toListItem = (entry, { position = null, eta = null, includeScore = false } = {}) => ({
  queueEntryId: entry.id,
  visitUuid: entry.visitUuid,
  patientUuid: entry.patientUuid,
  hwUserUuid: entry.hwUserUuid,
  speciality: entry.speciality,
  locationUuid: entry.locationUuid,
  status: entry.status,
  emergencyLevel: entry.emergencyLevel,
  caseType: entry.caseType,
  flagged: entry.flagged,
  escalated: entry.escalated,
  escalatedAt: entry.escalatedAt,
  chiefComplaint: entry.chiefComplaint,
  vitals: entry.vitals,
  position,
  waitedMinutes: Math.round(priority.minutesWaited(entry)),
  etaMinutes: eta ? eta.etaMinutes : entry.estimatedWaitMin,
  etaModelUsed: eta ? eta.model : entry.etaModelUsed,
  assignedDoctorUuid: entry.assignedDoctorUuid,
  requeueCount: entry.requeueCount,
  heartbeatFlagged: entry.heartbeatFlagged,
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
  if (filters.escalated !== undefined) where.escalated = filters.escalated;
  if (filters.flagged !== undefined) where.flagged = filters.flagged;
  if (filters.heartbeatFlagged !== undefined) where.heartbeatFlagged = filters.heartbeatFlagged;
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
    recent: [["createdAt", "DESC"], ["id", "DESC"]],
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
        ...(config.queue.scope === "SPECIALITY_LOCATION"
          ? { locationUuid: row.locationUuid || null }
          : {}),
        waiting: 0,
        escalated: 0,
        critical: 0,
        flagged: 0,
        heartbeatFlagged: 0,
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
      if (row.escalated) bucket.escalated += 1;
      if (row.emergencyLevel === EMERGENCY_LEVEL.CRITICAL) bucket.critical += 1;
      if (row.flagged) bucket.flagged += 1;
      if (row.heartbeatFlagged) bucket.heartbeatFlagged += 1;

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
      scopedToCaller: Boolean(auth && !privileged),
    },
    specialities,
  };
};

/**
 * GET /api/queue/doctor/:doctorUuid/list — the doctor panel.
 * Merges the critical lane with the doctor's speciality lane (LLD §09.2).
 */
const listForDoctor = async (doctorUuid, { speciality, locationUuid, limit = 50, offset = 0 } = {}) => {
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

  const scope = { speciality: resolvedSpeciality, locationUuid };
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
      escalated: entry.escalated,
      status: entry.status,
      chiefComplaint: entry.chiefComplaint,
      vitals: entry.vitals,
      position: offset + index + 1,
      waitedMinutes: Math.round(priority.minutesWaited(entry)),
      etaMinutes: entry.estimatedWaitMin,
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
const claimNext = async (doctorUuid, { speciality, locationUuid } = {}) => {
  let resolvedSpeciality = speciality;
  if (!resolvedSpeciality) {
    const status = await doctorStatus.getStatus(doctorUuid);
    resolvedSpeciality = status?.speciality;
  }
  if (!resolvedSpeciality) {
    throw new BadRequestError("speciality is required", "SPECIALITY_REQUIRED");
  }

  const scope = { speciality: resolvedSpeciality, locationUuid };

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
  // correction, not the patient's fault.
  const returnStatus = entry.escalated ? STATUS.ESCALATED : STATUS.QUEUED;
  assertTransition(entry.status, returnStatus, { queueEntryId });

  const restoredScore = entry.scoreBeforeAssignment ?? entry.priorityScore;

  const [affected] = await models.queue_entries.update(
    {
      status: returnStatus,
      assignedDoctorUuid: null,
      assignedAt: null,
      finalPosition: null,
      priorityScore: restoredScore,
      cancellationReason: reason,
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
  logger.info("Case released", { queueEntryId, doctorUuid });

  return statusPayload(entry);
};

/** The web-rtc call-start hook: the room has been requested. */
const markConnecting = async (queueEntryId) => {
  const entry = await findEntry(queueEntryId);
  assertTransition(entry.status, STATUS.CONNECTING, { queueEntryId });
  await entry.update({ status: STATUS.CONNECTING });
  return statusPayload(entry);
};

/** The web-rtc call-start hook: media is flowing. */
const markConnected = async (queueEntryId) => {
  const entry = await findEntry(queueEntryId);
  assertTransition(entry.status, STATUS.CONNECTED, { queueEntryId });
  await entry.update({ status: STATUS.CONNECTED, connectedAt: new Date() });
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
 * POST /api/queue/:id/complete — mirrors the naming of the existing
 * completeAppointment. Frees the doctor and updates the EMA that feeds μ.
 */
const complete = async (queueEntryId, doctorUuid, { source = "DOCTOR" } = {}) => {
  const entry = await findEntry(queueEntryId);
  assertTransition(entry.status, STATUS.COMPLETED, { queueEntryId });

  const completedAt = new Date();
  const start = entry.connectedAt || entry.assignedAt;
  const durationMin = start ? (completedAt.getTime() - new Date(start).getTime()) / 60000 : null;

  await entry.update({ status: STATUS.COMPLETED, completedAt, completionSource: source });

  const doctor = doctorUuid || entry.assignedDoctorUuid;
  if (doctor) {
    await updateConsultStats(doctor, entry.speciality, durationMin);
    await doctorStatus.setStatus(doctor, DOCTOR_STATUS.ONLINE, { speciality: entry.speciality });
  }

  logger.info("Case completed", { queueEntryId, doctorUuid: doctor, durationMin });

  // A doctor just became free — that is exactly the trigger for case-first
  // dispatch of whatever is now at the front of the lane.
  await dispatchLane(scopeOf(entry));
  notification.scheduleLaneUpdate(scopeOf(entry));

  return statusPayload(entry);
};

/**
 * Connection failed or timed out — LLD §04's RE_QUEUED state: back to QUEUED
 * with a priority bump so a patient whose call keeps dropping does not slide
 * down the line each time.
 */
const requeue = async (queueEntryId, { reason = "CONNECTION_FAILED" } = {}) => {
  const entry = await findEntry(queueEntryId);
  assertTransition(entry.status, STATUS.RE_QUEUED, { queueEntryId });

  const doctorUuid = entry.assignedDoctorUuid;
  const restored = entry.scoreBeforeAssignment ?? entry.priorityScore;
  const bumped = restored + config.queue.requeueBonus;

  await entry.update({
    status: entry.escalated ? STATUS.ESCALATED : STATUS.QUEUED,
    assignedDoctorUuid: null,
    assignedAt: null,
    connectedAt: null,
    finalPosition: null,
    priorityScore: bumped,
    // The bump belongs to the base, not to aging: the aging job must keep
    // applying W(m) against the same queued_at without erasing the bump.
    baseScore: entry.baseScore + config.queue.requeueBonus,
    requeueCount: entry.requeueCount + 1,
    cancellationReason: reason,
  });

  if (doctorUuid) {
    await doctorStatus.setStatus(doctorUuid, DOCTOR_STATUS.ONLINE, { speciality: entry.speciality });
  }

  notification.scheduleLaneUpdate(scopeOf(entry));
  logger.info("Case re-queued", { queueEntryId, reason, requeueCount: entry.requeueCount });

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
  dispatchLane,
  assignCase,
  statusPayload,
  findEntry,
  updateConsultStats,
  scopeOf,
};
