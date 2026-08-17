const { Op } = require("sequelize");

const models = require("../models");
const config = require("../config/env");
const { STATUS, WAITING_STATUSES, IN_SERVICE_STATUSES, EMERGENCY_LEVEL } = require("../constants");

/**
 * The lane layer — the MySQL equivalent of the design's Redis sorted sets
 * (backend LLD §03) and of the critical fast lane read contract (Priority
 * Engine §05).
 *
 * Mapping used throughout:
 *   ZADD / ZINCRBY   → UPDATE queue_entries SET priority_score = ...
 *   ZREVRANGE 0 0    → ORDER BY priority_score DESC, queued_at ASC, id ASC LIMIT 1
 *   ZREVRANK         → COUNT(*) of entries that sort ahead, + 1
 *   ZREM (1 or 0)    → conditional UPDATE, affectedRows tells you who won
 *   queue:critical   → a separate, exclusive read path (never a higher weight)
 *
 * Ordering inside a lane is `priority_score DESC, queued_at ASC, id ASC`. The
 * trailing keys are the exact FIFO tie-break the spec's ε term was standing in
 * for; see the note at the top of priority.service.js.
 *
 * ── THREE LANES, DRAINED IN ORDER ────────────────────────────────────────────
 *
 *   1. ESCALATED — cases the SLA job force-promoted past their cap (§05.3)
 *   2. CRITICAL  — the fast lane (§05.4)
 *   3. NORMAL    — everything else, by score
 *
 * The escalated lane exists because the two specs, taken literally, disagree:
 * LLD §05.4 says the critical lane "drains first and only checks the speciality
 * queue if it's empty", while Priority Engine §09's starvation regression
 * requires a FOLLOW_UP to be dequeued within its 45-minute cap "regardless of
 * N" critical arrivals per hour. Both cannot hold if CRITICAL always wins:
 * a high enough critical arrival rate starves everything behind it forever.
 *
 * They reconcile on the wording. §05.4's guarantee is that no *score
 * arithmetic* can delay an emergency — and it still holds, because CRITICAL is
 * a separate read path, not a weight. The SLA force-promote is not score
 * arithmetic; it is the independent safety net §05.3 describes, and LLD §04
 * defines ESCALATED as "sits at the front regardless of score". So an SLA
 * breach overrides the fast lane, and nothing else does.
 *
 * Set ESCALATION_OUTRANKS_CRITICAL=false to get the strict §05.4 reading
 * instead (CRITICAL first, escalations behind it). That is a clinical call, not
 * an engineering one — see the README's open decisions.
 *
 * Within the escalated lane the order is by escalated_at ASC: first to breach,
 * first served. Ordering it by score would be LIFO, because §04's force-promote
 * sets each newly escalated case to the current top score + 1.
 */
const ORDER = [
  ["priorityScore", "DESC"],
  ["queuedAt", "ASC"],
  ["id", "ASC"],
];

const ESCALATED_ORDER = [
  ["escalatedAt", "ASC"],
  ["priorityScore", "DESC"],
  ["id", "ASC"],
];

/**
 * Which entries share a line with this one.
 *
 * LLD §13.5 asks whether the live queue is one shared line per speciality
 * across every facility, or split per facility. Unresolved in the doc, so it is
 * config here (QUEUE_SCOPE) rather than baked into the query — flipping it does
 * not need a migration, because location_uuid is already stored.
 */
const laneScope = ({ speciality, locationUuid }) => {
  const where = { speciality };
  if (config.queue.scope === "SPECIALITY_LOCATION") {
    where.locationUuid = locationUuid ?? null;
  }
  return where;
};

const isCritical = (entry) => entry.emergencyLevel === EMERGENCY_LEVEL.CRITICAL;

const escalatedLaneWhere = (scope) => ({ ...laneScope(scope), status: STATUS.ESCALATED });

/**
 * Priority Engine §05 — the critical fast lane, as a read contract.
 *
 * CRITICAL cases are never merely "weighted higher": they sit on a separate
 * read path, so no scoring bug in the normal formula can let a non-critical
 * case preempt a critical one.
 *
 * Scope note: LLD §03 describes the lane as holding CRITICAL cases from all
 * specialities. Taken literally that offers a cardiology emergency to whichever
 * doctor is free, which the assignment eligibility filter (§06) then has to
 * reject. Default here is SPECIALITY — the lane is exclusive within the
 * speciality it belongs to. CRITICAL_LANE_SCOPE=GLOBAL restores the literal
 * reading.
 */
const criticalLaneWhere = (scope) => {
  const base = { status: STATUS.QUEUED, emergencyLevel: EMERGENCY_LEVEL.CRITICAL };
  if (config.queue.criticalLaneScope === "GLOBAL") return base;
  return { ...laneScope(scope), ...base };
};

const normalLaneWhere = (scope) => ({
  ...laneScope(scope),
  status: STATUS.QUEUED,
  emergencyLevel: { [Op.ne]: EMERGENCY_LEVEL.CRITICAL },
});

/** The lanes in drain order, most urgent first. */
const lanesInOrder = (scope) => {
  const escalated = { name: "ESCALATED", where: escalatedLaneWhere(scope), order: ESCALATED_ORDER };
  const critical = { name: "CRITICAL", where: criticalLaneWhere(scope), order: ORDER };
  const normal = { name: "NORMAL", where: normalLaneWhere(scope), order: ORDER };
  return config.queue.escalationOutranksCritical
    ? [escalated, critical, normal]
    : [critical, escalated, normal];
};

const laneOf = (entry) => {
  if (entry.status === STATUS.ESCALATED) return "ESCALATED";
  return isCritical(entry) ? "CRITICAL" : "NORMAL";
};

/** Entries that sort strictly ahead of `entry` within one lane. */
const countAheadIn = async (lane, entry, transaction) => {
  const byEscalation = lane.order === ESCALATED_ORDER;
  const primary = byEscalation ? "escalatedAt" : "priorityScore";
  const primaryValue = byEscalation ? entry.escalatedAt || new Date() : entry.priorityScore;
  const secondaryValue = byEscalation ? entry.priorityScore : entry.queuedAt || new Date();

  // Ahead means: better on the primary key, or tied on it and better on the
  // secondary, or tied on both and a lower id.
  const primaryAhead = byEscalation
    ? { [primary]: { [Op.lt]: primaryValue } }
    : { [primary]: { [Op.gt]: primaryValue } };
  const secondaryAhead = byEscalation
    ? { [primary]: primaryValue, priorityScore: { [Op.gt]: secondaryValue } }
    : { [primary]: primaryValue, queuedAt: { [Op.lt]: secondaryValue } };
  const idAhead = byEscalation
    ? { [primary]: primaryValue, priorityScore: secondaryValue, id: { [Op.lt]: entry.id } }
    : { [primary]: primaryValue, queuedAt: secondaryValue, id: { [Op.lt]: entry.id } };

  return models.queue_entries.count({
    where: { ...lane.where, [Op.or]: [primaryAhead, secondaryAhead, idAhead] },
    transaction,
  });
};

/**
 * Live position, 1-based — the ZREVRANK equivalent, across all three lanes.
 *
 * Because the lanes drain in order, a case sits behind every waiting case in
 * every lane ahead of its own, regardless of arithmetic. Reporting anything
 * else would under-promise the wait for exactly the patients most likely to be
 * leapfrogged (LLD §07's "stay honest under a priority queue" note).
 */
const getPosition = async (entry, transaction) => {
  if (!WAITING_STATUSES.includes(entry.status)) return null;

  const lanes = lanesInOrder(entry);
  const own = laneOf(entry);
  let ahead = 0;

  for (const lane of lanes) {
    if (lane.name === own) {
      ahead += await countAheadIn(lane, entry, transaction);
      break;
    }
    ahead += await models.queue_entries.count({ where: lane.where, transaction });
  }

  return ahead + 1;
};

/** Waiting cases in this scope, by lane. */
const getLaneDepth = async (scope, transaction) => {
  const lanes = lanesInOrder(scope);
  const counts = await Promise.all(
    lanes.map((lane) => models.queue_entries.count({ where: lane.where, transaction }))
  );
  const byLane = Object.fromEntries(lanes.map((lane, i) => [lane.name, counts[i]]));
  return { ...byLane, total: counts.reduce((a, b) => a + b, 0) };
};

/**
 * Cases currently being consulted in this speciality.
 *
 * This is the term the naive formula omitted — the Little's Law production
 * report put it at the centre of the 168 → 52 minute MAE improvement (LLD §07).
 */
const getInServiceCount = async (scope, transaction) =>
  models.queue_entries.count({
    where: {
      ...laneScope(scope),
      status: { [Op.in]: IN_SERVICE_STATUSES },
    },
    transaction,
  });

/**
 * The next case to serve — lanes drained strictly in order, each exhausted
 * before the next is consulted at all.
 *
 * `lock` takes the row FOR UPDATE SKIP LOCKED so two doctors asking for "next
 * patient" at the same moment cannot be handed the same one (MySQL 8.0.1+).
 */
const peekNext = async (scope, { transaction, lock = false } = {}) => {
  for (const lane of lanesInOrder(scope)) {
    const found = await models.queue_entries.findOne({
      where: lane.where,
      order: lane.order,
      transaction,
      ...(lock && transaction ? { lock: transaction.LOCK.UPDATE, skipLocked: true } : {}),
    });
    if (found) return found;
  }
  return null;
};

/**
 * Ordered waiting cases for the doctor panel — the merge of the critical lane
 * and the speciality lane that LLD §09.2 describes, with escalations on top.
 */
const listLane = async (scope, { limit = 50, offset = 0 } = {}) => {
  const lanes = lanesInOrder(scope);
  const results = await Promise.all(
    lanes.map((lane) => models.queue_entries.findAll({ where: lane.where, order: lane.order }))
  );
  const merged = results.flat();
  return { rows: merged.slice(offset, offset + limit), total: merged.length };
};

/**
 * id → live position for every waiting case in one scope, in one pass.
 *
 * `getPosition` costs a COUNT per case, which is right for a single lookup and
 * wrong for a list: a page of 50 would fire 50+ counts. This walks the lanes
 * once and returns the whole ranking, so positions on a paginated list are
 * still relative to the *full* lane rather than to the page.
 */
const rankMap = async (scope) => {
  const positions = new Map();
  let ahead = 0;

  for (const lane of lanesInOrder(scope)) {
    const rows = await models.queue_entries.findAll({
      where: lane.where,
      order: lane.order,
      attributes: ["id"],
      raw: true,
    });
    rows.forEach((row, index) => positions.set(row.id, ahead + index + 1));
    ahead += rows.length;
  }

  return positions;
};

/**
 * SQL ordering that reproduces the lane order (ESCALATED → CRITICAL → NORMAL,
 * then by score) in a single query. `lanesInOrder` is the read path for
 * *serving* the next case; this is for listing, where one ORDER BY across
 * mixed specialities is what a caller actually wants.
 */
const listOrder = () => {
  const escalatedFirst = "(status = 'ESCALATED') DESC";
  const criticalFirst = "(emergency_level = 'CRITICAL') DESC";
  const laneOrder = config.queue.escalationOutranksCritical
    ? [escalatedFirst, criticalFirst]
    : [criticalFirst, escalatedFirst];

  return [
    ...laneOrder.map((clause) => models.sequelize.literal(clause)),
    ["priorityScore", "DESC"],
    ["queuedAt", "ASC"],
    ["id", "ASC"],
  ];
};

/**
 * The current top score in the entry's own lane — used by the SLA
 * force-promote job (Priority Engine §04), which must read it rather than
 * hardcode a constant, because W(m) grows without bound.
 */
const topScore = async (scope, transaction) => {
  const lanes = lanesInOrder(scope);
  const own = lanes.find((lane) => lane.name === laneOf(scope)) || lanes[lanes.length - 1];
  const top = await models.queue_entries.max("priorityScore", { where: own.where, transaction });
  return Number.isFinite(top) ? top : 0;
};

module.exports = {
  ORDER,
  ESCALATED_ORDER,
  laneScope,
  lanesInOrder,
  laneOf,
  escalatedLaneWhere,
  criticalLaneWhere,
  normalLaneWhere,
  isCritical,
  getPosition,
  rankMap,
  listOrder,
  getLaneDepth,
  getInServiceCount,
  peekNext,
  listLane,
  topScore,
};
