const test = require("node:test");
const assert = require("node:assert/strict");

const { canTransition, assertTransition, isTerminal } = require("../src/utils/stateMachine");
const { STATUS } = require("../src/constants");
const { ConflictError } = require("../src/utils/errors");

/**
 * Backend LLD §04.
 *
 * "If a request tries to release a case that's already COMPLETED, or claim one
 * that's already CANCELLED, reject it with a clear error instead of silently
 * overwriting the record. This wasn't written down anywhere before; it needs to
 * be, because a stale mobile app retrying an old request is exactly the kind of
 * thing that would otherwise corrupt a case's state."
 */

test("terminal states accept nothing", () => {
  for (const terminal of [STATUS.COMPLETED, STATUS.CANCELLED]) {
    assert.ok(isTerminal(terminal));
    for (const target of Object.values(STATUS)) {
      assert.equal(
        canTransition(terminal, target),
        false,
        `${terminal} → ${target} should be rejected`
      );
    }
  }
});

test("the stale-retry cases the doc names are rejected with a 409", () => {
  // Releasing a case that is already COMPLETED.
  assert.throws(
    () => assertTransition(STATUS.COMPLETED, STATUS.QUEUED),
    (err) => err instanceof ConflictError && err.status === 409 && err.code === "INVALID_STATE_TRANSITION"
  );

  // Claiming a case that is already CANCELLED.
  assert.throws(
    () => assertTransition(STATUS.CANCELLED, STATUS.ASSIGNED),
    (err) => err instanceof ConflictError && /already CANCELLED/.test(err.message)
  );
});

test("the happy path from the §04 arrows is allowed end to end", () => {
  const path = [
    [STATUS.SUBMITTED, STATUS.QUEUED],
    [STATUS.QUEUED, STATUS.ASSIGNED],
    [STATUS.ASSIGNED, STATUS.CONNECTING],
    [STATUS.CONNECTING, STATUS.CONNECTED],
    [STATUS.CONNECTED, STATUS.COMPLETED],
  ];
  for (const [from, to] of path) {
    assert.ok(canTransition(from, to), `${from} → ${to} should be allowed`);
  }
});

test("escalation and re-queue paths are allowed", () => {
  assert.ok(canTransition(STATUS.QUEUED, STATUS.ESCALATED));
  assert.ok(canTransition(STATUS.ESCALATED, STATUS.ASSIGNED));
  assert.ok(canTransition(STATUS.CONNECTING, STATUS.RE_QUEUED));
  assert.ok(canTransition(STATUS.CONNECTED, STATUS.RE_QUEUED));
  assert.ok(canTransition(STATUS.RE_QUEUED, STATUS.QUEUED));
  // Release: back to the line, or back to the front if it had already breached.
  assert.ok(canTransition(STATUS.ASSIGNED, STATUS.QUEUED));
  assert.ok(canTransition(STATUS.ASSIGNED, STATUS.ESCALATED));
});

test("states cannot be skipped or repeated", () => {
  assert.equal(canTransition(STATUS.QUEUED, STATUS.CONNECTED), false);
  assert.equal(canTransition(STATUS.QUEUED, STATUS.COMPLETED), false);
  assert.equal(canTransition(STATUS.SUBMITTED, STATUS.CONNECTING), false);
  assert.equal(canTransition(STATUS.QUEUED, STATUS.QUEUED), false);
  assert.equal(canTransition(STATUS.ESCALATED, STATUS.QUEUED), false);
});

test("the conflict carries what the client needs to recover", () => {
  try {
    assertTransition(STATUS.CANCELLED, STATUS.ASSIGNED, { queueEntryId: 42 });
    assert.fail("expected a ConflictError");
  } catch (err) {
    assert.equal(err.details.from, STATUS.CANCELLED);
    assert.equal(err.details.to, STATUS.ASSIGNED);
    assert.equal(err.details.queueEntryId, 42);
    assert.deepEqual(err.details.allowed, []);
  }
});
