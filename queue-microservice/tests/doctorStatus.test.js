const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");

const { DOCTOR_STATUS, STATUS, ONGOING_VISIT_STATUSES } = require("../src/constants");
const doctorRoute = require("../src/routes/doctor.route");
const { validateBody, validateQuery } = require("../src/middleware/validate");
const models = require("../src/models");
const doctorStatus = require("../src/services/doctorStatus.service");

/**
 * PATCH /api/doctor/:doctorUuid/status — the client-facing status change.
 *
 * in_consult belongs to the queue (it carries the case pointer), and a doctor
 * who still holds a case must not be marked free by an "online" toggle, or
 * dispatch would hand them a second patient mid-call.
 */

const runValidator = (middleware, req) => {
  let error = null;
  middleware(req, null, (err) => {
    error = err || null;
  });
  return error;
};

/** In-memory doctor_queue_status + queue_entries, restored after each test. */
const stubModels = (t, { activeCase = null } = {}) => {
  const rows = new Map();
  const statusModel = models.doctor_queue_status;
  const entriesModel = models.queue_entries;
  const original = {
    findOrCreate: statusModel.findOrCreate,
    findOne: entriesModel.findOne,
  };

  statusModel.findOrCreate = async ({ where, defaults }) => {
    const existing = rows.get(where.doctorUuid);
    if (existing) return [existing, false];
    const row = {
      ...defaults,
      async update(patch) {
        Object.assign(this, patch);
        return this;
      },
    };
    rows.set(where.doctorUuid, row);
    return [row, true];
  };
  // Honour the status filter, so the test exercises which statuses count.
  entriesModel.findOne = async ({ where }) =>
    activeCase && where.status[Op.in].includes(activeCase.status) ? activeCase : null;

  t.after(() => {
    statusModel.findOrCreate = original.findOrCreate;
    entriesModel.findOne = original.findOne;
  });
  return rows;
};

test("PATCH accepts online, away and offline", () => {
  for (const status of [DOCTOR_STATUS.ONLINE, DOCTOR_STATUS.AWAY, DOCTOR_STATUS.OFFLINE]) {
    const req = { body: { status } };
    assert.equal(runValidator(validateBody(doctorRoute.schemas.updateStatus), req), null);
    assert.equal(req.validated.status, status);
  }
});

test("PATCH refuses in_consult at validation — it is system-owned", () => {
  const err = runValidator(validateBody(doctorRoute.schemas.updateStatus), {
    body: { status: DOCTOR_STATUS.IN_CONSULT },
  });
  assert.ok(err);
  assert.equal(err.code, "VALIDATION_ERROR");
});

test("changeStatus refuses in_consult even if called directly", async () => {
  await assert.rejects(
    doctorStatus.changeStatus("doc-1", DOCTOR_STATUS.IN_CONSULT),
    (err) => err.code === "IN_CONSULT_SYSTEM_OWNED"
  );
});

test("online with no case held goes online", async (t) => {
  stubModels(t);
  const { row, heldInConsult, requestedStatus } = await doctorStatus.changeStatus(
    "doc-1",
    DOCTOR_STATUS.ONLINE,
    { speciality: "Dermatology" }
  );
  assert.equal(row.status, DOCTOR_STATUS.ONLINE);
  assert.equal(row.currentQueueEntryId, null);
  assert.equal(heldInConsult, false);
  assert.equal(requestedStatus, DOCTOR_STATUS.ONLINE);
});

test("online while still holding a case keeps the doctor in_consult on that case", async (t) => {
  stubModels(t, { activeCase: { id: 42, status: STATUS.CALL_CONNECTED } });
  const { row, heldInConsult, requestedStatus } = await doctorStatus.changeStatus(
    "doc-1",
    DOCTOR_STATUS.ONLINE
  );
  assert.equal(row.status, DOCTOR_STATUS.IN_CONSULT);
  assert.equal(row.currentQueueEntryId, 42);
  assert.equal(heldInConsult, true);
  assert.equal(requestedStatus, DOCTOR_STATUS.ONLINE);
});

const ONGOING = [STATUS.ASSIGNED, STATUS.CALL_CONNECTING, STATUS.CALL_CONNECTED, STATUS.CALL_COMPLETED];
const NOT_ONGOING = [
  STATUS.QUEUED,
  STATUS.RE_QUEUED,
  STATUS.ESCALATED,
  STATUS.PRESCRIPTION_COMPLETED,
  STATUS.CANCELLED,
];

for (const status of [DOCTOR_STATUS.OFFLINE, DOCTOR_STATUS.AWAY]) {
  for (const caseStatus of ONGOING) {
    test(`${status} is refused while a visit is ${caseStatus}, and names the case`, async (t) => {
      const rows = stubModels(t, { activeCase: { id: 42, visitUuid: "visit-42", status: caseStatus } });
      await assert.rejects(doctorStatus.changeStatus("doc-1", status), (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, "DOCTOR_HAS_ONGOING_VISIT");
        assert.deepEqual(err.details, { queueEntryId: 42, visitUuid: "visit-42", caseStatus });
        return true;
      });
      assert.equal(rows.size, 0, "a refused change must not write a status row");
    });
  }

  for (const caseStatus of NOT_ONGOING) {
    test(`${status} is allowed when the doctor's case is ${caseStatus}`, async (t) => {
      stubModels(t, { activeCase: { id: 42, status: caseStatus } });
      const { row } = await doctorStatus.changeStatus("doc-1", status);
      assert.equal(row.status, status);
      assert.equal(row.currentQueueEntryId, null);
    });
  }

  test(`${status} with no case at all is applied`, async (t) => {
    stubModels(t);
    const { row } = await doctorStatus.changeStatus("doc-1", status);
    assert.equal(row.status, status);
  });
}

test("online after the call ends (prescription owed) is online, not held in_consult", async (t) => {
  // The doctor is freed when the call ends so one owed prescription cannot
  // stall the lane; the pending prescription only blocks logging off.
  stubModels(t, { activeCase: { id: 42, status: STATUS.CALL_COMPLETED } });
  const { row, heldInConsult } = await doctorStatus.changeStatus("doc-1", DOCTOR_STATUS.ONLINE);
  assert.equal(row.status, DOCTOR_STATUS.ONLINE);
  assert.equal(heldInConsult, false);
});

test("the ongoing-visit set is exactly the four statuses", () => {
  assert.deepEqual([...ONGOING_VISIT_STATUSES].sort(), [...ONGOING].sort());
});

test("list filter accepts any doctor status, including in_consult", () => {
  const req = { query: { status: DOCTOR_STATUS.IN_CONSULT, speciality: "Dermatology" } };
  assert.equal(runValidator(validateQuery(doctorRoute.schemas.listStatuses), req), null);
  assert.deepEqual(req.validatedQuery, { status: DOCTOR_STATUS.IN_CONSULT, speciality: "Dermatology" });

  const bad = runValidator(validateQuery(doctorRoute.schemas.listStatuses), { query: { status: "busy" } });
  assert.equal(bad.code, "VALIDATION_ERROR");
});
