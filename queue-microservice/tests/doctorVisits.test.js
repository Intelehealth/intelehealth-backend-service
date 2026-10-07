const test = require("node:test");
const assert = require("node:assert/strict");

const { STATUS, ONGOING_VISIT_STATUSES } = require("../src/constants");
const models = require("../src/models");
const queueLane = require("../src/services/queueLane.service");
const etaService = require("../src/services/eta.service");
const queue = require("../src/services/queue.service");

/**
 * GET /api/queue/doctor/:doctorUuid/visits — the doctor's one ongoing visit
 * plus every waiting case in the speciality.
 */

const row = (id, fields = {}) => ({
  id,
  visitUuid: `visit-${id}`,
  patientUuid: `patient-${id}`,
  speciality: "General Physician",
  status: STATUS.QUEUED,
  queuedAt: new Date(Date.now() - 10 * 60 * 1000),
  escalatedAt: null,
  etaAt: null,
  ...fields,
});

const stub = (t, { current = null, waiting = [] } = {}) => {
  const saved = {
    findOne: models.queue_entries.findOne,
    listLane: queueLane.listLane,
    estimateMany: etaService.estimateMany,
  };
  const calls = { findOne: null, listLane: null };

  models.queue_entries.findOne = async (opts) => {
    calls.findOne = opts;
    return current;
  };
  queueLane.listLane = async (scope, { limit = 50, offset = 0 } = {}) => {
    calls.listLane = { scope, limit, offset };
    return { rows: waiting.slice(offset, offset + limit), total: waiting.length };
  };
  etaService.estimateMany = async () => new Map();

  t.after(() => {
    models.queue_entries.findOne = saved.findOne;
    queueLane.listLane = saved.listLane;
    etaService.estimateMany = saved.estimateMany;
  });
  return calls;
};

test("returns the doctor's ongoing visit and the speciality's waiting cases", async (t) => {
  const current = row(9, { status: STATUS.CALL_CONNECTED, assignedDoctorUuid: "doc-1" });
  const calls = stub(t, { current, waiting: [row(1), row(2), row(3)] });

  const result = await queue.listDoctorVisits("doc-1", { speciality: "General Physician" });

  assert.equal(result.currentVisit.queueEntryId, 9);
  assert.equal(result.currentVisit.status, STATUS.CALL_CONNECTED);
  assert.deepEqual(result.items.map((i) => i.queueEntryId), [1, 2, 3]);
  assert.deepEqual(result.items.map((i) => i.position), [1, 2, 3]);
  assert.equal(result.total, 3);
  assert.equal(result.hasMore, false);
  assert.deepEqual(calls.listLane.scope, { speciality: "General Physician" });
});

test("current visit is looked up only in ongoing statuses for that doctor", async (t) => {
  const calls = stub(t);

  await queue.listDoctorVisits("doc-1", { speciality: "General Physician" });

  const where = calls.findOne.where;
  assert.equal(where.assignedDoctorUuid, "doc-1");
  const statuses = Object.getOwnPropertySymbols(where.status).map((s) => where.status[s])[0];
  assert.deepEqual([...statuses].sort(), [...ONGOING_VISIT_STATUSES].sort());
  assert.ok(!statuses.includes(STATUS.PRESCRIPTION_COMPLETED));
  assert.ok(!statuses.includes(STATUS.CANCELLED));
});

test("currentVisit is null when the doctor has no ongoing visit", async (t) => {
  stub(t, { waiting: [row(1)] });

  const result = await queue.listDoctorVisits("doc-1", { speciality: "General Physician" });

  assert.equal(result.currentVisit, null);
  assert.equal(result.items.length, 1);
});

test("positions on a later page count from the full lane, not the page", async (t) => {
  stub(t, { waiting: [row(1), row(2), row(3), row(4), row(5)] });

  const result = await queue.listDoctorVisits("doc-1", { speciality: "General Physician", limit: 2, offset: 2 });

  assert.deepEqual(result.items.map((i) => i.queueEntryId), [3, 4]);
  assert.deepEqual(result.items.map((i) => i.position), [3, 4]);
  assert.equal(result.total, 5);
  assert.equal(result.hasMore, true);
});
