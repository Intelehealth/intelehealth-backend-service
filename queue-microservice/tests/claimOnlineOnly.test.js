const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");

const { DOCTOR_STATUS, STATUS } = require("../src/constants");
const models = require("../src/models");
const notification = require("../src/services/notification.service");
const queue = require("../src/services/queue.service");

/**
 * Only an online doctor can be assigned a case — on claim, claim-next and
 * dispatch alike. The check lives in assignCase as a conditional
 * online -> in_consult UPDATE inside the same transaction as the case UPDATE,
 * so it cannot be raced and a lost case rolls the reservation back.
 */

/**
 * In-memory doctor_queue_status + queue_entries with a transaction that
 * restores both tables if its callback throws. Restored after each test.
 */
const stubWorld = (t, { doctors = {}, cases = {} } = {}) => {
  const doctorRows = new Map(Object.entries(doctors).map(([uuid, d]) => [uuid, { doctorUuid: uuid, ...d }]));
  const caseRows = new Map(Object.entries(cases).map(([id, c]) => [Number(id), { id: Number(id), ...c }]));

  const saved = {
    transaction: models.sequelize.transaction,
    doctorUpdate: models.doctor_queue_status.update,
    doctorFindOne: models.doctor_queue_status.findOne,
    caseUpdate: models.queue_entries.update,
    notifyReady: notification.notifyReady,
    scheduleLaneUpdate: notification.scheduleLaneUpdate,
  };

  const clone = (m) => new Map([...m].map(([k, v]) => [k, { ...v }]));

  models.sequelize.transaction = async (fn) => {
    const before = { doctors: clone(doctorRows), cases: clone(caseRows) };
    try {
      return await fn({});
    } catch (err) {
      doctorRows.clear();
      for (const [k, v] of before.doctors) doctorRows.set(k, v);
      caseRows.clear();
      for (const [k, v] of before.cases) caseRows.set(k, v);
      throw err;
    }
  };
  models.doctor_queue_status.update = async (patch, { where }) => {
    const row = doctorRows.get(where.doctorUuid);
    if (!row || row.status !== where.status) return [0];
    Object.assign(row, patch);
    return [1];
  };
  models.doctor_queue_status.findOne = async ({ where }) => doctorRows.get(where.doctorUuid) || null;
  models.queue_entries.update = async (patch, { where }) => {
    const row = caseRows.get(where.id);
    if (!row || !where.status[Op.in].includes(row.status)) return [0];
    Object.assign(row, patch);
    return [1];
  };
  notification.notifyReady = async () => {};
  notification.scheduleLaneUpdate = () => {};

  t.after(() => {
    models.sequelize.transaction = saved.transaction;
    models.doctor_queue_status.update = saved.doctorUpdate;
    models.doctor_queue_status.findOne = saved.doctorFindOne;
    models.queue_entries.update = saved.caseUpdate;
    notification.notifyReady = saved.notifyReady;
    notification.scheduleLaneUpdate = saved.scheduleLaneUpdate;
  });

  return { doctorRows, caseRows };
};

/** A queue entry the way assignCase sees it: plain fields plus reload(). */
const entryFor = (caseRows, id) => ({
  ...caseRows.get(id),
  async reload() {
    Object.assign(this, caseRows.get(id));
    return this;
  },
});

test("an online doctor is assigned, and moved to in_consult on that case", async (t) => {
  const { doctorRows, caseRows } = stubWorld(t, {
    doctors: { "doc-1": { status: DOCTOR_STATUS.ONLINE } },
    cases: { 7: { status: STATUS.QUEUED, speciality: "Dermatology" } },
  });

  const assigned = await queue.assignCase(entryFor(caseRows, 7), "doc-1", { source: "CLAIM" });

  assert.equal(assigned.status, STATUS.ASSIGNED);
  assert.equal(caseRows.get(7).assignedDoctorUuid, "doc-1");
  assert.equal(doctorRows.get("doc-1").status, DOCTOR_STATUS.IN_CONSULT);
  assert.equal(doctorRows.get("doc-1").currentQueueEntryId, 7);
});

for (const status of [DOCTOR_STATUS.OFFLINE, DOCTOR_STATUS.AWAY, DOCTOR_STATUS.IN_CONSULT]) {
  test(`a doctor who is ${status} is refused with DOCTOR_NOT_ONLINE, and the case is untouched`, async (t) => {
    const { doctorRows, caseRows } = stubWorld(t, {
      doctors: { "doc-1": { status } },
      cases: { 7: { status: STATUS.QUEUED, speciality: "Dermatology" } },
    });

    await assert.rejects(queue.assignCase(entryFor(caseRows, 7), "doc-1"), (err) => {
      assert.equal(err.status, 409);
      assert.equal(err.code, "DOCTOR_NOT_ONLINE");
      assert.equal(err.details.doctorStatus, status);
      return true;
    });
    assert.equal(caseRows.get(7).status, STATUS.QUEUED);
    assert.equal(caseRows.get(7).assignedDoctorUuid, undefined);
    assert.equal(doctorRows.get("doc-1").status, status);
  });
}

test("a doctor with no status row at all counts as offline", async (t) => {
  const { caseRows } = stubWorld(t, { cases: { 7: { status: STATUS.QUEUED } } });
  await assert.rejects(queue.assignCase(entryFor(caseRows, 7), "doc-new"), (err) => {
    assert.equal(err.code, "DOCTOR_NOT_ONLINE");
    assert.equal(err.details.doctorStatus, DOCTOR_STATUS.OFFLINE);
    return true;
  });
});

test("losing the case rolls the doctor's reservation back to online", async (t) => {
  const { doctorRows, caseRows } = stubWorld(t, {
    doctors: { "doc-1": { status: DOCTOR_STATUS.ONLINE, currentQueueEntryId: null } },
    cases: { 7: { status: STATUS.ASSIGNED, assignedDoctorUuid: "doc-2" } },
  });

  const result = await queue.assignCase(entryFor(caseRows, 7), "doc-1");

  assert.equal(result, null);
  assert.equal(doctorRows.get("doc-1").status, DOCTOR_STATUS.ONLINE);
  assert.equal(doctorRows.get("doc-1").currentQueueEntryId, null);
});

test("the same doctor cannot hold two cases: the second claim is refused", async (t) => {
  const { caseRows } = stubWorld(t, {
    doctors: { "doc-1": { status: DOCTOR_STATUS.ONLINE } },
    cases: { 7: { status: STATUS.QUEUED }, 8: { status: STATUS.QUEUED } },
  });

  await queue.assignCase(entryFor(caseRows, 7), "doc-1");
  await assert.rejects(queue.assignCase(entryFor(caseRows, 8), "doc-1"), (err) => {
    assert.equal(err.code, "DOCTOR_NOT_ONLINE");
    assert.equal(err.details.doctorStatus, DOCTOR_STATUS.IN_CONSULT);
    return true;
  });
  assert.equal(caseRows.get(8).status, STATUS.QUEUED);
});

test("claimNext refuses a doctor who is not online before looking at the queue", async (t) => {
  stubWorld(t, { doctors: { "doc-1": { status: DOCTOR_STATUS.AWAY, speciality: "Dermatology" } } });
  let locked = false;
  const savedTx = models.sequelize.transaction;
  models.sequelize.transaction = async () => {
    locked = true;
    return null;
  };
  t.after(() => {
    models.sequelize.transaction = savedTx;
  });

  await assert.rejects(queue.claimNext("doc-1"), (err) => err.code === "DOCTOR_NOT_ONLINE");
  assert.equal(locked, false, "no case should be locked for a doctor who cannot take it");
});
