const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STATUS,
  WAITING_STATUSES,
  IN_SERVICE_STATUSES,
  TERMINAL_STATUSES,
  POST_CALL_STATUSES,
} = require("../src/constants");
const { TRANSITIONS, canTransition, assertTransition } = require("../src/utils/stateMachine");
const queue = require("../src/services/queue.service");
const config = require("../src/config/env");

/**
 * CALL_COMPLETED — a finished call is not a finished visit.
 *
 * The doctor still owes a prescription, and the consultation is only complete
 * once that is shared. The status sits between CONNECTED and COMPLETED, and its
 * placement in the status GROUPS is what makes the rest of the system behave:
 * it must not look like a queueing case, and it must not look like a busy
 * doctor.
 */

test("a finished call and a finished visit are two different states", () => {
  assert.equal(STATUS.CALL_COMPLETED, "CALL_COMPLETED");
  assert.equal(STATUS.PRESCRIPTION_COMPLETED, "PRESCRIPTION_COMPLETED");
  assert.notEqual(STATUS.CALL_COMPLETED, STATUS.PRESCRIPTION_COMPLETED);
  assert.equal(Object.keys(STATUS).length, 10);
  // There is no bare "COMPLETED" left to be ambiguous about which one ended.
  assert.equal(STATUS.COMPLETED, undefined);
  assert.ok(!Object.values(STATUS).includes("COMPLETED"));
});

test("a finished call reaches it, and only a prescription leaves it", () => {
  assert.ok(canTransition(STATUS.CALL_CONNECTED, STATUS.CALL_COMPLETED));
  assert.ok(canTransition(STATUS.CALL_COMPLETED, STATUS.PRESCRIPTION_COMPLETED));
  assert.ok(canTransition(STATUS.CALL_COMPLETED, STATUS.CANCELLED));

  // Those are the only two ways out. A case past its call does not go back
  // into the queue: the consultation happened, and what is outstanding is the
  // prescription, not another slot with a doctor.
  assert.deepEqual(TRANSITIONS[STATUS.CALL_COMPLETED], [
    STATUS.PRESCRIPTION_COMPLETED,
    STATUS.CANCELLED,
  ]);
  assert.equal(canTransition(STATUS.CALL_COMPLETED, STATUS.RE_QUEUED), false);
});

test("a prescription can also close a consultation that never had a call", () => {
  // An asynchronous consultation: the doctor writes the prescription straight
  // from the notes without a call ever being placed.
  assert.ok(canTransition(STATUS.ASSIGNED, STATUS.PRESCRIPTION_COMPLETED));
  assert.ok(canTransition(STATUS.CALL_CONNECTING, STATUS.PRESCRIPTION_COMPLETED));
  assert.ok(canTransition(STATUS.CALL_CONNECTED, STATUS.PRESCRIPTION_COMPLETED));
  // But never from the queue — nobody has consulted with the patient yet.
  assert.equal(canTransition(STATUS.QUEUED, STATUS.PRESCRIPTION_COMPLETED), false);
  assert.equal(canTransition(STATUS.RE_QUEUED, STATUS.PRESCRIPTION_COMPLETED), false);
});

test("it cannot be reached from anywhere a call has not happened", () => {
  for (const from of [
    STATUS.SUBMITTED,
    STATUS.QUEUED,
    STATUS.ESCALATED,
    STATUS.ASSIGNED,
    STATUS.CALL_CONNECTING,
  ]) {
    assert.equal(
      canTransition(from, STATUS.CALL_COMPLETED),
      false,
      `${from} must not reach CALL_COMPLETED — no call has finished`
    );
  }
});

test("CONNECTED can still complete directly, for ungated deployments", () => {
  // REQUIRE_PRESCRIPTION_TO_COMPLETE=false must keep working, and an admin
  // must be able to close a case out.
  assert.ok(canTransition(STATUS.CALL_CONNECTED, STATUS.PRESCRIPTION_COMPLETED));
});

test("it is NOT a waiting status — no position, no ETA", () => {
  // A patient past their call is not queueing for a slot any more; counting
  // them would inflate everyone else's position and wait estimate.
  assert.ok(!WAITING_STATUSES.includes(STATUS.CALL_COMPLETED));
});

test("it is NOT an in-service status — the doctor is freed at call end", () => {
  // This is the one that keeps the queue moving: if it counted as in-service,
  // a doctor who forgot to write a prescription would stall their whole lane
  // and would keep inflating Lq in the wait estimate.
  assert.ok(!IN_SERVICE_STATUSES.includes(STATUS.CALL_COMPLETED));
});

test("it is not terminal — the case is still open", () => {
  assert.ok(!TERMINAL_STATUSES.includes(STATUS.CALL_COMPLETED));
  assert.deepEqual(POST_CALL_STATUSES, [STATUS.CALL_COMPLETED]);
  assert.deepEqual(TRANSITIONS[STATUS.PRESCRIPTION_COMPLETED], []);
});

test("listing groups treat it as an open case", () => {
  const { STATUS_GROUPS } = queue;
  assert.ok(STATUS_GROUPS.ACTIVE.includes(STATUS.CALL_COMPLETED));
  assert.ok(!STATUS_GROUPS.WAITING.includes(STATUS.CALL_COMPLETED));
  assert.deepEqual(STATUS_GROUPS.AWAITING_PRESCRIPTION, [STATUS.CALL_COMPLETED]);
  assert.ok(STATUS_GROUPS.ALL.includes(STATUS.CALL_COMPLETED));
});

/* ── How long a prescription has been outstanding ───────────────────────── */

const pending = (minutesAgo) => ({
  status: STATUS.CALL_COMPLETED,
  callEndedAt: new Date(Date.now() - minutesAgo * 60000),
});

test("outstanding time is measured from when the CALL ended", () => {
  assert.equal(queue.prescriptionOutstandingMinutes(pending(0)), 0);
  assert.equal(queue.prescriptionOutstandingMinutes(pending(25)), 25);
  assert.equal(queue.prescriptionOutstandingMinutes(pending(180)), 180);
});

test("overdue is reported past the configured threshold, in both directions", () => {
  const limit = config.queue.prescriptionOverdueMinutes;
  assert.equal(queue.prescriptionOverdue(pending(limit - 1)), false);
  assert.equal(queue.prescriptionOverdue(pending(limit)), false, "exactly at the limit is not over");
  assert.equal(queue.prescriptionOverdue(pending(limit + 1)), true);
});

test("a case not awaiting a prescription reports null, not zero", () => {
  // null and 0 mean very different things to a dashboard: "not applicable"
  // versus "outstanding for under a minute".
  for (const status of [STATUS.QUEUED, STATUS.CALL_CONNECTED, STATUS.PRESCRIPTION_COMPLETED]) {
    assert.equal(
      queue.prescriptionOutstandingMinutes({ status, callEndedAt: new Date() }),
      null,
      status
    );
    assert.equal(queue.prescriptionOverdue({ status, callEndedAt: new Date() }), false, status);
  }
});

test("a pending case with no call-end timestamp degrades to null, never NaN", () => {
  const orphan = { status: STATUS.CALL_COMPLETED, callEndedAt: null };
  assert.equal(queue.prescriptionOutstandingMinutes(orphan), null);
  assert.equal(queue.prescriptionOverdue(orphan), false);
});

test("nothing auto-completes an outstanding prescription", () => {
  // A machine must not discharge a clinical obligation by timing it out. The
  // threshold is for reporting only, so it must not appear as a transition.
  assert.ok(!canTransition(STATUS.CALL_COMPLETED, STATUS.CALL_COMPLETED));
  assert.throws(
    () => assertTransition(STATUS.PRESCRIPTION_COMPLETED, STATUS.CALL_COMPLETED),
    (err) => err.code === "INVALID_STATE_TRANSITION"
  );
});
