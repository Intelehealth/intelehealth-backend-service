const test = require("node:test");
const assert = require("node:assert/strict");

const { STATUS } = require("../src/constants");
const models = require("../src/models");
const queue = require("../src/services/queue.service");
const controller = require("../src/controllers/queue.controller");
const queueRoute = require("../src/routes/queue.route");
const { validateBody } = require("../src/middleware/validate");

/**
 * POST /api/queue/visit/:visitUuid/call-not-happened — the doctor records why
 * the call with the patient never happened. The reason is stored on the queue
 * entry; the case status is left alone.
 */

const entryFor = (fields = {}) => ({
  id: 7,
  visitUuid: "visit-1",
  speciality: "General Physician",
  status: STATUS.ASSIGNED,
  assignedDoctorUuid: "doc-1",
  connectedAt: null,
  escalatedAt: null,
  callNotHappenedReason: null,
  ...fields,
  async update(patch) {
    Object.assign(this, patch);
    return this;
  },
});

const stubEntry = (t, entry) => {
  const saved = models.queue_entries.findOne;
  models.queue_entries.findOne = async ({ where }) => (entry && where.visitUuid === entry.visitUuid ? entry : null);
  t.after(() => {
    models.queue_entries.findOne = saved;
  });
};

test("stores the reason and leaves the case status alone", async (t) => {
  const entry = entryFor();
  stubEntry(t, entry);

  const payload = await queue.markCallNotHappened("visit-1", { reason: "Network Issue", doctorUuid: "doc-1" });

  assert.equal(entry.callNotHappenedReason, "Network Issue");
  assert.equal(entry.status, STATUS.ASSIGNED);
  assert.equal(payload.callNotHappenedReason, "Network Issue");
  assert.equal(payload.status, STATUS.ASSIGNED);
});

test("can be recorded while connecting, or after the visit closed without a call", async (t) => {
  for (const status of [STATUS.CALL_CONNECTING, STATUS.PRESCRIPTION_COMPLETED]) {
    const entry = entryFor({ status });
    stubEntry(t, entry);

    await queue.markCallNotHappened("visit-1", { reason: "Patient Unavailable" });
    assert.equal(entry.callNotHappenedReason, "Patient Unavailable", status);
  }
});

test("sending it again replaces the reason", async (t) => {
  const entry = entryFor({ callNotHappenedReason: "Other" });
  stubEntry(t, entry);

  await queue.markCallNotHappened("visit-1", { reason: "Async Consultation", doctorUuid: "doc-1" });
  assert.equal(entry.callNotHappenedReason, "Async Consultation");
});

test("refused once the call connected", async (t) => {
  const entry = entryFor({ status: STATUS.CALL_COMPLETED, connectedAt: new Date() });
  stubEntry(t, entry);

  await assert.rejects(
    queue.markCallNotHappened("visit-1", { reason: "Network Issue" }),
    (err) => err.code === "CALL_ALREADY_HAPPENED" && err.status === 409
  );
  assert.equal(entry.callNotHappenedReason, null);
});

test("refused for a case no doctor has taken", async (t) => {
  for (const status of [STATUS.QUEUED, STATUS.RE_QUEUED, STATUS.ESCALATED, STATUS.CANCELLED]) {
    const entry = entryFor({ status, assignedDoctorUuid: null });
    stubEntry(t, entry);

    await assert.rejects(
      queue.markCallNotHappened("visit-1", { reason: "Network Issue" }),
      (err) => err.code === "NO_CALL_EXPECTED",
      status
    );
  }
});

test("a doctor cannot mark another doctor's case", async (t) => {
  const entry = entryFor({ assignedDoctorUuid: "doc-2" });
  stubEntry(t, entry);

  await assert.rejects(
    queue.markCallNotHappened("visit-1", { reason: "Network Issue", doctorUuid: "doc-1" }),
    (err) => err.code === "CASE_NOT_ASSIGNED_TO_YOU"
  );
  assert.equal(entry.callNotHappenedReason, null);
});

test("an unknown visit is a 404", async (t) => {
  stubEntry(t, null);

  await assert.rejects(
    queue.markCallNotHappened("visit-404", { reason: "Network Issue" }),
    (err) => err.code === "QUEUE_ENTRY_NOT_FOUND"
  );
});

test("the reason is required and at most 100 characters", () => {
  const run = (body) => {
    let error = null;
    const req = { body };
    validateBody(queueRoute.schemas.callNotHappened)(req, null, (err) => {
      error = err || null;
    });
    return { error, req };
  };

  assert.ok(run({}).error);
  assert.ok(run({ reason: "   " }).error);
  assert.ok(run({ reason: "x".repeat(101) }).error);

  const { error, req } = run({ reason: "  Network Issue " });
  assert.equal(error, null);
  assert.equal(req.validated.reason, "Network Issue");
});

test("a doctor marks as themselves; admins and services can mark any case", async (t) => {
  const calls = [];
  const saved = queue.markCallNotHappened;
  queue.markCallNotHappened = async (visitUuid, opts) => {
    calls.push({ visitUuid, ...opts });
    return {};
  };
  t.after(() => {
    queue.markCallNotHappened = saved;
  });

  const res = { status: () => res, json: () => res };
  const send = (auth) =>
    controller.callNotHappened(
      { params: { visitUuid: "visit-1" }, validated: { reason: "Other" }, auth },
      res
    );

  await send({ userUuid: "doc-1", isAdmin: false, isService: false });
  await send({ userUuid: "admin-1", isAdmin: true, isService: false });
  await send({ userUuid: null, isAdmin: false, isService: true });

  assert.deepEqual(
    calls.map((c) => c.doctorUuid),
    ["doc-1", null, null]
  );
  assert.ok(calls.every((c) => c.reason === "Other" && c.visitUuid === "visit-1"));
});
