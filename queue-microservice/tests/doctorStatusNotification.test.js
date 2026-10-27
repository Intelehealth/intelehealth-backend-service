const test = require("node:test");
const assert = require("node:assert/strict");

const config = require("../src/config/env");
const notification = require("../src/services/notification.service");
const queueLane = require("../src/services/queueLane.service");
const recipients = require("../src/services/recipients.service");
const pushService = require("../src/services/push.service");
const doctorStatus = require("../src/services/doctorStatus.service");
const messages = require("../src/services/notificationMessages");
const controller = require("../src/controllers/doctor.controller");
const { DOCTOR_STATUS } = require("../src/constants");
const { EVENT } = require("../src/constants/events");

/**
 * When a doctor goes away, or comes back online from away, every health worker
 * with a case waiting in that speciality is told — once each, however many
 * cases they have waiting. Other changes stay silent.
 */

/** Waiting cases in the lane, recipients with one device each, and the pushes sent. */
const stubDelivery = (t, waiting) => {
  const sent = [];
  const laneCalls = [];
  const original = {
    listLane: queueLane.listLane,
    forUsers: recipients.forUsers,
    send: pushService.sendCloudNotification,
    enabled: config.notification.enabled,
  };

  queueLane.listLane = async (scope) => {
    laneCalls.push(scope);
    return { rows: waiting, total: waiting.length };
  };
  recipients.forUsers = async (uuids) =>
    new Map(uuids.map((uuid) => [uuid, { userUuid: uuid, locale: "en", tokens: [`tok-${uuid}`], webpushSubs: [] }]));
  pushService.sendCloudNotification = async (args) => {
    sent.push(args);
  };
  config.notification.enabled = true;

  t.after(() => {
    queueLane.listLane = original.listLane;
    recipients.forUsers = original.forUsers;
    pushService.sendCloudNotification = original.send;
    config.notification.enabled = original.enabled;
  });
  return { sent, laneCalls };
};

const away = { doctorUuid: "doc-1", status: DOCTOR_STATUS.AWAY, speciality: "General Physician" };

test("away pushes once to each health worker with a case waiting", async (t) => {
  const { sent, laneCalls } = stubDelivery(t, [
    { id: 1, hwUserUuid: "hw-1" },
    { id: 2, hwUserUuid: "hw-2" },
    { id: 3, hwUserUuid: "hw-1" },
  ]);

  const count = await notification.notifyHwsOfDoctorStatus(away);

  assert.equal(count, 2);
  assert.deepEqual(laneCalls, [{ speciality: "General Physician" }]);
  assert.deepEqual(sent.map((s) => s.regTokens[0]).sort(), ["tok-hw-1", "tok-hw-2"]);

  const { data, notification: shown } = sent[0];
  assert.equal(data.event, EVENT.DOCTOR_STATUS);
  assert.equal(data.doctorStatus, "away");
  assert.equal(data.DoctorUuid, "doc-1");
  assert.equal(data.speciality, "General Physician");
  assert.equal(shown.title, "A doctor is away — General Physician");
});

test("coming back online from away is announced as the doctor being back", async (t) => {
  const { sent } = stubDelivery(t, [{ id: 1, hwUserUuid: "hw-1" }]);

  const count = await notification.notifyHwsOfDoctorStatus({
    ...away,
    status: DOCTOR_STATUS.ONLINE,
    previousStatus: DOCTOR_STATUS.AWAY,
  });

  assert.equal(count, 1);
  assert.equal(sent[0].data.doctorStatus, "online");
  assert.equal(sent[0].data.previousDoctorStatus, "away");
  assert.equal(sent[0].notification.title, "A doctor is back — General Physician");
});

test("online from anything but away is not announced, so a login doesn't push", async (t) => {
  const { sent, laneCalls } = stubDelivery(t, [{ id: 1, hwUserUuid: "hw-1" }]);

  for (const previousStatus of [null, DOCTOR_STATUS.OFFLINE, DOCTOR_STATUS.IN_CONSULT]) {
    assert.equal(
      await notification.notifyHwsOfDoctorStatus({ ...away, status: DOCTOR_STATUS.ONLINE, previousStatus }),
      0
    );
  }
  assert.equal(sent.length, 0);
  assert.equal(laneCalls.length, 0);
});

test("statuses not configured push nothing and don't read the queue", async (t) => {
  const { sent, laneCalls } = stubDelivery(t, [{ id: 1, hwUserUuid: "hw-1" }]);

  for (const status of [DOCTOR_STATUS.OFFLINE, DOCTOR_STATUS.IN_CONSULT]) {
    assert.equal(await notification.notifyHwsOfDoctorStatus({ ...away, status, previousStatus: "away" }), 0);
  }
  assert.equal(sent.length, 0);
  assert.equal(laneCalls.length, 0);
});

test("the statuses come from config, so others can be turned on later", async (t) => {
  const { sent } = stubDelivery(t, [{ id: 1, hwUserUuid: "hw-1" }]);
  const original = config.notification.hwDoctorStatuses;
  t.after(() => {
    config.notification.hwDoctorStatuses = original;
  });

  config.notification.hwDoctorStatuses = [];
  assert.equal(await notification.notifyHwsOfDoctorStatus(away), 0);

  config.notification.hwDoctorStatuses = ["away", "offline"];
  assert.equal(await notification.notifyHwsOfDoctorStatus({ ...away, status: DOCTOR_STATUS.OFFLINE }), 1);
  assert.equal(sent.length, 1);
});

test("nothing is pushed without a speciality or with nobody waiting", async (t) => {
  const { sent } = stubDelivery(t, []);

  assert.equal(await notification.notifyHwsOfDoctorStatus({ ...away, speciality: null }), 0);
  assert.equal(await notification.notifyHwsOfDoctorStatus(away), 0);
  assert.equal(sent.length, 0);
});

test("the away message is localised like the other queue pushes", () => {
  const payload = { event: EVENT.DOCTOR_STATUS, doctorStatus: "away", speciality: "Pediatrics" };

  assert.deepEqual(messages.build(payload, "en"), {
    title: "A doctor is away — Pediatrics",
    body: "Your patient stays in the queue. The wait may be longer.",
  });
  assert.equal(messages.build(payload, "ru").title, "Врач отошёл — Pediatrics");

  const back = { ...payload, doctorStatus: "online", previousDoctorStatus: "away" };
  assert.deepEqual(messages.build(back, "en"), {
    title: "A doctor is back — Pediatrics",
    body: "A doctor is taking patients from the queue again.",
  });
  assert.equal(messages.build(back, "ru").title, "Врач вернулся — Pediatrics");
});

/** Runs PATCH /api/doctor/:doctorUuid/status with changeStatus stubbed. */
const patchStatus = async (t, { status, previousStatus }) => {
  const announced = [];
  const original = {
    changeStatus: doctorStatus.changeStatus,
    notify: notification.notifyHwsOfDoctorStatus,
  };
  doctorStatus.changeStatus = async () => ({
    row: { doctorUuid: "doc-1", status, speciality: "General Physician" },
    requestedStatus: status,
    heldInConsult: false,
    previousStatus,
  });
  notification.notifyHwsOfDoctorStatus = async (args) => {
    announced.push(args);
    return 1;
  };
  t.after(() => {
    doctorStatus.changeStatus = original.changeStatus;
    notification.notifyHwsOfDoctorStatus = original.notify;
  });

  const res = { status: () => res, json: () => res };
  await controller.updateStatus({ params: { doctorUuid: "doc-1" }, validated: { status } }, res);
  return announced;
};

test("going away announces the change to health workers", async (t) => {
  const announced = await patchStatus(t, { status: DOCTOR_STATUS.AWAY, previousStatus: DOCTOR_STATUS.ONLINE });

  assert.deepEqual(announced, [
    { doctorUuid: "doc-1", status: "away", previousStatus: "online", speciality: "General Physician" },
  ]);
});

test("coming back online passes the previous status along", async (t) => {
  const announced = await patchStatus(t, { status: DOCTOR_STATUS.ONLINE, previousStatus: DOCTOR_STATUS.AWAY });

  assert.equal(announced[0].previousStatus, "away");
});

test("re-sending the same status announces nothing", async (t) => {
  const announced = await patchStatus(t, { status: DOCTOR_STATUS.AWAY, previousStatus: DOCTOR_STATUS.AWAY });

  assert.equal(announced.length, 0);
});
