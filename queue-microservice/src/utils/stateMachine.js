/**
 * Case lifecycle state machine — backend LLD §04.
 *
 * "A case is only ever allowed to move to a state that's actually next on one
 * of the arrows. The API layer should check this before writing anything — if a
 * request tries to release a case that's already COMPLETED, or claim one that's
 * already CANCELLED, reject it with a clear error instead of silently
 * overwriting the record."
 *
 * This exists because a stale mobile app retrying an old request is exactly the
 * kind of thing that would otherwise corrupt a case's state.
 */
const { STATUS, TERMINAL_STATUSES } = require("../constants");
const { ConflictError } = require("./errors");

/**
 * The agreed lifecycle. A visit ends in exactly one of two places:
 * PRESCRIPTION_COMPLETED or CANCELLED. A finished *call* is not an ending — it
 * is CALL_COMPLETED, and the consultation stays open until the prescription is
 * shared.
 *
 *   SUBMITTED -> QUEUED -> ASSIGNED -> CALL_CONNECTING -> CALL_CONNECTED
 *                                                              |
 *                                                     CALL_COMPLETED
 *                                                              |
 *                                                   PRESCRIPTION_COMPLETED
 *
 * Four edges are marked (+) below. They are not in the agreed list but are
 * required for it to function, and each one is load-bearing for an endpoint or
 * job that already exists:
 *
 *   (+) QUEUED / RE_QUEUED -> ESCALATED    ESCALATED has outgoing edges in the
 *       agreed flow but no incoming one, which would make it unreachable and
 *       silently disable the §05.3 starvation SLA. This is the job that writes
 *       it.
 *   (+) ASSIGNED / CALL_CONNECTING -> RE_QUEUED (and -> ESCALATED for a case
 *       that had already escalated, so releasing it does not cost it the place
 *       its SLA breach earned). Without these, POST /release has nowhere to put
 *       a handed-back case and a call that never connects cannot go back in
 *       line — both would 409 on every request.
 */
const TRANSITIONS = {
  [STATUS.SUBMITTED]: [STATUS.QUEUED],
  [STATUS.QUEUED]: [STATUS.ASSIGNED, STATUS.RE_QUEUED, STATUS.CANCELLED, STATUS.ESCALATED /* + */],
  // ESCALATED is still queued — it can go anywhere QUEUED can.
  [STATUS.ESCALATED]: [STATUS.ASSIGNED, STATUS.CANCELLED, STATUS.RE_QUEUED],
  [STATUS.ASSIGNED]: [
    STATUS.CALL_CONNECTING,
    // A doctor may write a prescription without a call ever happening.
    STATUS.PRESCRIPTION_COMPLETED,
    STATUS.CANCELLED,
    STATUS.RE_QUEUED /* + */,
    STATUS.ESCALATED /* + */,
  ],
  [STATUS.CALL_CONNECTING]: [
    STATUS.CALL_CONNECTED,
    STATUS.PRESCRIPTION_COMPLETED,
    STATUS.CANCELLED,
    STATUS.RE_QUEUED /* + */,
    STATUS.ESCALATED /* + */,
  ],
  // PRESCRIPTION_COMPLETED direct from the call is the ungated path
  // (REQUIRE_PRESCRIPTION_TO_COMPLETE=false) and the admin close-out.
  [STATUS.CALL_CONNECTED]: [
    STATUS.CALL_COMPLETED,
    STATUS.PRESCRIPTION_COMPLETED,
    STATUS.CANCELLED,
  ],
  // The call is done; the visit is not. Only the prescription closes it.
  [STATUS.CALL_COMPLETED]: [STATUS.PRESCRIPTION_COMPLETED, STATUS.CANCELLED],
  // RE_QUEUED is a durable waiting state, not a marker: a case is assigned
  // straight out of it, and a second failed attempt re-enters it.
  [STATUS.RE_QUEUED]: [
    STATUS.ASSIGNED,
    STATUS.RE_QUEUED,
    STATUS.CANCELLED,
    STATUS.ESCALATED /* + */,
  ],
  [STATUS.PRESCRIPTION_COMPLETED]: [],
  [STATUS.CANCELLED]: [],
};

const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

/**
 * A state may repeat only where the lifecycle declares it (RE_QUEUED, for a
 * case whose second attempt also fails). Everywhere else a same-state write is
 * a stale retry and is refused.
 */
const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

/**
 * Throws a 409 with a message that says what actually happened, rather than
 * letting the write through.
 */
const assertTransition = (from, to, context = {}) => {
  if (canTransition(from, to)) return true;
  const reason = isTerminal(from)
    ? `case is already ${from} and cannot change`
    : `cannot move a case from ${from} to ${to}`;
  throw new ConflictError(reason, "INVALID_STATE_TRANSITION", {
    from,
    to,
    allowed: TRANSITIONS[from] || [],
    ...context,
  });
};

module.exports = { TRANSITIONS, canTransition, assertTransition, isTerminal };
