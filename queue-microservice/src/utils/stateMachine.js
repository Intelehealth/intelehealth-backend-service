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

const TRANSITIONS = {
  [STATUS.SUBMITTED]: [STATUS.QUEUED, STATUS.ASSIGNED, STATUS.CANCELLED],
  // ESCALATED is still queued — it can go anywhere QUEUED can.
  [STATUS.QUEUED]: [STATUS.ESCALATED, STATUS.ASSIGNED, STATUS.CANCELLED],
  [STATUS.ESCALATED]: [STATUS.ASSIGNED, STATUS.CANCELLED],
  // release → back to the line; timeout → RE_QUEUED with a bump.
  [STATUS.ASSIGNED]: [
    STATUS.CONNECTING,
    STATUS.QUEUED,
    STATUS.ESCALATED,
    STATUS.RE_QUEUED,
    STATUS.COMPLETED,
    STATUS.CANCELLED,
  ],
  [STATUS.CONNECTING]: [STATUS.CONNECTED, STATUS.RE_QUEUED, STATUS.CANCELLED],
  [STATUS.CONNECTED]: [STATUS.COMPLETED, STATUS.RE_QUEUED],
  // RE_QUEUED is a transient marker; the requeue write moves it straight on.
  [STATUS.RE_QUEUED]: [STATUS.QUEUED, STATUS.ESCALATED, STATUS.CANCELLED],
  [STATUS.COMPLETED]: [],
  [STATUS.CANCELLED]: [],
};

const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

const canTransition = (from, to) => {
  if (from === to) return false;
  return (TRANSITIONS[from] || []).includes(to);
};

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
