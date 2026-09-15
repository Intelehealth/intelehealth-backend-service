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
  for (const terminal of [STATUS.PRESCRIPTION_COMPLETED, STATUS.CANCELLED]) {
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
    () => assertTransition(STATUS.PRESCRIPTION_COMPLETED, STATUS.QUEUED),
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
    [STATUS.ASSIGNED, STATUS.CALL_CONNECTING],
    [STATUS.CALL_CONNECTING, STATUS.CALL_CONNECTED],
    [STATUS.CALL_CONNECTED, STATUS.PRESCRIPTION_COMPLETED],
  ];
  for (const [from, to] of path) {
    assert.ok(canTransition(from, to), `${from} → ${to} should be allowed`);
  }
});

test("escalation and re-queue paths are allowed", () => {
  assert.ok(canTransition(STATUS.QUEUED, STATUS.ESCALATED));
  assert.ok(canTransition(STATUS.ESCALATED, STATUS.ASSIGNED));
  // A call that never established is a failed attempt — back in the line.
  assert.ok(canTransition(STATUS.CALL_CONNECTING, STATUS.RE_QUEUED));
  // A call that DID connect is not. However briefly it lasted, the doctor and
  // patient reached each other, so it ends at CALL_COMPLETED and is closed by a
  // prescription or cancelled outright — it is never quietly put back in the
  // queue as though the consultation had not happened.
  assert.equal(canTransition(STATUS.CALL_CONNECTED, STATUS.RE_QUEUED), false);
  // RE_QUEUED is a waiting state a doctor is assigned straight out of, not a
  // marker that has to be cleared back to QUEUED first.
  assert.ok(canTransition(STATUS.RE_QUEUED, STATUS.ASSIGNED));
  assert.equal(canTransition(STATUS.RE_QUEUED, STATUS.QUEUED), false);
  // A second failed attempt re-enters it — the one declared self-transition.
  assert.ok(canTransition(STATUS.RE_QUEUED, STATUS.RE_QUEUED));
  // A re-queued case that then breaches its SLA can still be force-promoted.
  assert.ok(canTransition(STATUS.RE_QUEUED, STATUS.ESCALATED));
  // Release: back to the line, or back to the front if it had already breached.
  assert.ok(canTransition(STATUS.ASSIGNED, STATUS.RE_QUEUED));
  assert.ok(canTransition(STATUS.ASSIGNED, STATUS.ESCALATED));
  assert.equal(canTransition(STATUS.ASSIGNED, STATUS.QUEUED), false);
});

test("states cannot be skipped or repeated", () => {
  assert.equal(canTransition(STATUS.QUEUED, STATUS.CALL_CONNECTED), false);
  assert.equal(canTransition(STATUS.QUEUED, STATUS.PRESCRIPTION_COMPLETED), false);
  assert.equal(canTransition(STATUS.SUBMITTED, STATUS.CALL_CONNECTING), false);
  assert.equal(canTransition(STATUS.QUEUED, STATUS.QUEUED), false);
  assert.equal(canTransition(STATUS.ESCALATED, STATUS.QUEUED), false);
  // A repeat is refused everywhere the lifecycle does not declare one, so the
  // RE_QUEUED self-loop cannot be read as a general licence to re-write a state.
  for (const s of [STATUS.ASSIGNED, STATUS.CALL_CONNECTED, STATUS.CALL_COMPLETED]) {
    assert.equal(canTransition(s, s), false, s);
  }
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
