const test = require("node:test");
const assert = require("node:assert/strict");

const { DOCTOR_STATUS, STATUS } = require("../src/constants");
const config = require("../src/config/env");
const models = require("../src/models");
const notification = require("../src/services/notification.service");
const queueLane = require("../src/services/queueLane.service");
const queue = require("../src/services/queue.service");

/**
 * Nothing is auto-assigned. A doctor stays in_consult from the moment a case
 * is assigned until its prescription is shared; then they go online — and only
 * online. The next case is theirs to take with claim or claim-next.
 */

/** One queue entry and the doctor status table, in memory. Restored after each test. */
const stubWorld = (t, { entry, doctors = {} }) => {
  const doctorRows = new Map(
    Object.entries(doctors).map(([uuid, d]) => [
      uuid,
      {
        doctorUuid: uuid,
        ...d,
        async update(patch) {
          Object.assign(this, patch);
          return this;
        },
      },
    ])
  );
  const row = {
    ...entry,
    async update(patch) {
      Object.assign(this, patch);
      return this;
    },
  };
  let peeked = 0;

  const saved = {
    findOne: models.queue_entries.findOne,
    findByPk: models.queue_entries.findByPk,
    doctorFindOne: models.doctor_queue_status.findOne,
    doctorFindOrCreate: models.doctor_queue_status.findOrCreate,
    statsFindOrCreate: models.doctor_service_stats.findOrCreate,
    peekNext: queueLane.peekNext,
    scheduleLaneUpdate: notification.scheduleLaneUpdate,
    gated: config.queue.requirePrescriptionToComplete,
  };

  models.queue_entries.findOne = async () => row;
  models.queue_entries.findByPk = async () => row;
  models.doctor_queue_status.findOne = async ({ where }) => doctorRows.get(where.doctorUuid) || null;
  models.doctor_queue_status.findOrCreate = async ({ where }) => [doctorRows.get(where.doctorUuid), false];
  models.doctor_service_stats.findOrCreate = async ({ defaults }) => [{ ...defaults }, true];
  queueLane.peekNext = async () => {
    peeked += 1;
    return null;
  };
  notification.scheduleLaneUpdate = () => {};
  config.queue.requirePrescriptionToComplete = true;

  t.after(() => {
    models.queue_entries.findOne = saved.findOne;
    models.queue_entries.findByPk = saved.findByPk;
    models.doctor_queue_status.findOne = saved.doctorFindOne;
    models.doctor_queue_status.findOrCreate = saved.doctorFindOrCreate;
    models.doctor_service_stats.findOrCreate = saved.statsFindOrCreate;
    queueLane.peekNext = saved.peekNext;
    notification.scheduleLaneUpdate = saved.scheduleLaneUpdate;
    config.queue.requirePrescriptionToComplete = saved.gated;
  });

  return { row, doctorRows, peeked: () => peeked };
};

const connectedCase = {
  id: 7,
  visitUuid: "visit-7",
  speciality: "General Physician",
  status: STATUS.CALL_CONNECTED,
  assignedDoctorUuid: "doc-1",
  connectedAt: new Date(Date.now() - 10 * 60000),
};

test("the call ending keeps the doctor in_consult while the prescription is owed", async (t) => {
  const { row, doctorRows, peeked } = stubWorld(t, {
    entry: connectedCase,
    doctors: { "doc-1": { status: DOCTOR_STATUS.IN_CONSULT, currentQueueEntryId: 7 } },
  });

  await queue.complete(7, "doc-1");

  assert.equal(row.status, STATUS.CALL_COMPLETED);
  assert.equal(doctorRows.get("doc-1").status, DOCTOR_STATUS.IN_CONSULT);
  assert.equal(doctorRows.get("doc-1").currentQueueEntryId, 7);
  assert.equal(peeked(), 0, "nothing is looked up to assign");
});

test("sharing the prescription sets the doctor online and assigns nothing", async (t) => {
  const { row, doctorRows, peeked } = stubWorld(t, {
    entry: { ...connectedCase, status: STATUS.CALL_COMPLETED, callEndedAt: new Date() },
    doctors: { "doc-1": { status: DOCTOR_STATUS.IN_CONSULT, currentQueueEntryId: 7 } },
  });

  const { changed } = await queue.sharePrescription("visit-7");

  assert.equal(changed, true);
  assert.equal(row.status, STATUS.PRESCRIPTION_COMPLETED);
  assert.equal(doctorRows.get("doc-1").status, DOCTOR_STATUS.ONLINE);
  assert.equal(doctorRows.get("doc-1").currentQueueEntryId, null);
  assert.equal(peeked(), 0, "nothing is looked up to assign");
});

test("sharing the prescription mid-call also ends the call and sets the doctor online", async (t) => {
  const { row, doctorRows, peeked } = stubWorld(t, {
    entry: connectedCase,
    doctors: { "doc-1": { status: DOCTOR_STATUS.IN_CONSULT, currentQueueEntryId: 7 } },
  });

  await queue.sharePrescription("visit-7");

  assert.equal(row.status, STATUS.PRESCRIPTION_COMPLETED);
  assert.equal(doctorRows.get("doc-1").status, DOCTOR_STATUS.ONLINE);
  assert.equal(peeked(), 0);
});

test("a doctor already in_consult on another case is left there", async (t) => {
  const { doctorRows } = stubWorld(t, {
    entry: { ...connectedCase, status: STATUS.CALL_COMPLETED, callEndedAt: new Date() },
    doctors: { "doc-1": { status: DOCTOR_STATUS.IN_CONSULT, currentQueueEntryId: 99 } },
  });

  await queue.sharePrescription("visit-7");

  assert.equal(doctorRows.get("doc-1").status, DOCTOR_STATUS.IN_CONSULT);
  assert.equal(doctorRows.get("doc-1").currentQueueEntryId, 99);
});

test("dispatch is gone from the service", () => {
  assert.equal(queue.dispatchLane, undefined);
});
