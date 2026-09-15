const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STATUS,
  WAITING_STATUSES,
  IN_SERVICE_STATUSES,
  TERMINAL_STATUSES,
  POST_CALL_STATUSES,
} = require("../src/constants");
const { TRANSITIONS, canTransition } = require("../src/utils/stateMachine");

/**
 * The agreed case lifecycle, written out as the contract rather than inferred
 * from the implementation. If someone edits TRANSITIONS, this is what says
 * whether they changed the agreement or just the code.
 *
 * Four edges are marked ADDED. They are not in the agreed list, and are here
 * because without them a state in that list is unreachable or an endpoint that
 * already exists has nowhere to write. They are listed explicitly so that
 * "what we agreed" and "what we had to add to make it run" stay distinguishable.
 */
const AGREED = {
  SUBMITTED: ["QUEUED"],
  QUEUED: ["ASSIGNED", "RE_QUEUED", "CANCELLED"],
  ESCALATED: ["ASSIGNED", "CANCELLED", "RE_QUEUED"],
  ASSIGNED: ["CALL_CONNECTING", "PRESCRIPTION_COMPLETED", "CANCELLED"],
  CALL_CONNECTING: ["CALL_CONNECTED", "PRESCRIPTION_COMPLETED", "CANCELLED"],
  CALL_CONNECTED: ["CALL_COMPLETED", "PRESCRIPTION_COMPLETED", "CANCELLED"],
  CALL_COMPLETED: ["PRESCRIPTION_COMPLETED", "CANCELLED"],
  PRESCRIPTION_COMPLETED: [],
  CANCELLED: [],
  RE_QUEUED: ["ASSIGNED", "RE_QUEUED", "CANCELLED"],
};

const ADDED = {
  // ESCALATED has outgoing edges in the agreed flow but no incoming one. These
  // are the SLA force-promote job, without which it is dead code.
  QUEUED: ["ESCALATED"],
  RE_QUEUED: ["ESCALATED"],
  // POST /release, and a call that ends before it connects. Without these both
  // 409 on every request.
  ASSIGNED: ["RE_QUEUED", "ESCALATED"],
  CALL_CONNECTING: ["RE_QUEUED", "ESCALATED"],
};

const sorted = (list) => [...list].sort();

test("every agreed transition is allowed", () => {
  for (const [from, targets] of Object.entries(AGREED)) {
    for (const to of targets) {
      assert.ok(canTransition(from, to), `${from} -> ${to} should be allowed`);
    }
  }
});

test("nothing is allowed beyond the agreement and the four marked additions", () => {
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    const permitted = sorted([...(AGREED[from] || []), ...(ADDED[from] || [])]);
    assert.deepEqual(
      sorted(targets),
      permitted,
      `${from} allows something the lifecycle does not`
    );
  }
});

test("the state set is exactly the agreed one", () => {
  assert.deepEqual(sorted(Object.values(STATUS)), sorted(Object.keys(AGREED)));
  // Every status is a key in the transition table — a state with no entry at
  // all would silently reject every write out of it.
  assert.deepEqual(sorted(Object.keys(TRANSITIONS)), sorted(Object.values(STATUS)));
});

test("a visit ends in exactly two places", () => {
  const dead = Object.entries(TRANSITIONS)
    .filter(([, targets]) => targets.length === 0)
    .map(([from]) => from);
  assert.deepEqual(sorted(dead), sorted([STATUS.PRESCRIPTION_COMPLETED, STATUS.CANCELLED]));
  assert.deepEqual(sorted(TERMINAL_STATUSES), sorted(dead));
});

test("the only successful ending is a shared prescription", () => {
  // CANCELLED is the other terminal, and it is not a success. So there is no
  // way to finish a visit well without a prescription — which is the point.
  assert.equal(TERMINAL_STATUSES.length, 2);
  assert.ok(TERMINAL_STATUSES.includes(STATUS.PRESCRIPTION_COMPLETED));
  assert.ok(!Object.values(STATUS).includes("COMPLETED"));
});

test("every state is reachable from SUBMITTED", () => {
  // The check that catches a state defined, documented, and orphaned — which
  // is exactly what ESCALATED would have been.
  const seen = new Set([STATUS.SUBMITTED]);
  const queue = [STATUS.SUBMITTED];
  while (queue.length) {
    for (const next of TRANSITIONS[queue.shift()] || []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  assert.deepEqual(sorted([...seen]), sorted(Object.values(STATUS)));
});

test("the groups partition the lifecycle without overlapping", () => {
  const groups = [WAITING_STATUSES, IN_SERVICE_STATUSES, POST_CALL_STATUSES, TERMINAL_STATUSES];
  const all = groups.flat();
  assert.equal(new Set(all).size, all.length, "a status is in two groups at once");
  // SUBMITTED is the only status in no group: it exists for the instant
  // between the row being created and being queued.
  const ungrouped = Object.values(STATUS).filter((s) => !all.includes(s));
  assert.deepEqual(ungrouped, [STATUS.SUBMITTED]);
});

test("waiting means claimable, and claimable means waiting", () => {
  // Anything a doctor can be assigned from must be counted as waiting, or the
  // queue depth and the ETA disagree with what dispatch actually serves.
  const claimable = Object.entries(TRANSITIONS)
    .filter(([, targets]) => targets.includes(STATUS.ASSIGNED))
    .map(([from]) => from);
  assert.deepEqual(sorted(claimable), sorted(WAITING_STATUSES));
});
