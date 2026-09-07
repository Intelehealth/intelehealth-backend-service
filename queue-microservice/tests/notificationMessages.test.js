const test = require("node:test");
const assert = require("node:assert/strict");

const messages = require("../src/services/notificationMessages");
const { EVENT } = require("../src/constants/events");

/**
 * Notification copy and FCM data payloads.
 *
 * Portal picks copy with `locale === "ru" ? ru : en` and requires every value
 * in an FCM `data` object to be a string. Both behaviours are mirrored here, so
 * these tests pin them.
 */

test("every §10 event has copy in both locales", () => {
  for (const event of Object.values(EVENT)) {
    for (const locale of ["en", "ru"]) {
      const { title, body } = messages.build({ event, position: 2, etaMinutes: 30 }, locale);
      assert.ok(title && typeof title === "string", `${event}/${locale} has no title`);
      assert.ok(body && typeof body === "string", `${event}/${locale} has no body`);
    }
  }
});

test("locale selection matches portal's rule — 'ru' or fall back to English", () => {
  const ru = messages.build({ event: EVENT.READY }, "ru");
  const en = messages.build({ event: EVENT.READY }, "en");
  const unknown = messages.build({ event: EVENT.READY }, "fr");
  const missing = messages.build({ event: EVENT.READY }, undefined);

  assert.notEqual(ru.title, en.title);
  assert.deepEqual(unknown, en, "an unknown locale must fall back to English, not throw");
  assert.deepEqual(missing, en);
});

test("position copy states the expected clock time, not a duration", () => {
  // A duration is stale the moment the notification is read; a time is not.
  const etaAt = new Date("2026-08-18T09:05:00Z");
  const en = messages.build({ event: EVENT.POSITION, position: 4, etaAt }, "en");
  assert.match(en.title, /number 4/);
  assert.match(en.body, /Expected around \d{1,2}:\d{2}/);
  assert.doesNotMatch(en.body, /minute/);
});

test("a missing ETA degrades to a position-only message rather than 'undefined'", () => {
  for (const locale of ["en", "ru"]) {
    const { body } = messages.build({ event: EVENT.POSITION, position: 3 }, locale);
    assert.doesNotMatch(body, /undefined|null|NaN|Invalid/);
  }
});

test("an unparseable etaAt is treated as absent, never rendered", () => {
  for (const etaAt of ["not-a-date", "", 0, NaN]) {
    const { body } = messages.build({ event: EVENT.POSITION, position: 2, etaAt }, "en");
    assert.doesNotMatch(body, /undefined|null|NaN|Invalid/, `etaAt=${String(etaAt)}`);
  }
});

test("escalation copy mentions the breached cap when it is known", () => {
  const withCap = messages.build({ event: EVENT.ESCALATED, capMinutes: 45 }, "en");
  assert.match(withCap.body, /45/);
  const withoutCap = messages.build({ event: EVENT.ESCALATED }, "en");
  assert.doesNotMatch(withoutCap.body, /undefined|null/);
});

test("the health worker's queued confirmation names the position and speciality", () => {
  const en = messages.build(
    { event: EVENT.QUEUED, position: 3, etaAt: new Date("2026-08-18T09:40:00Z"), speciality: "Cardiology" },
    "en"
  );
  assert.match(en.body, /number 3/);
  assert.match(en.body, /Cardiology/);
  assert.match(en.body, /expected around \d{1,2}:\d{2}/i);

  const ru = messages.build(
    { event: EVENT.QUEUED, position: 3, etaAt: new Date("2026-08-18T09:40:00Z"), speciality: "Cardiology" },
    "ru"
  );
  assert.notEqual(ru.title, en.title);
  assert.doesNotMatch(ru.body, /undefined|null|NaN/);
});

test("a queued confirmation with no ETA yet still reads properly", () => {
  for (const locale of ["en", "ru"]) {
    const { body } = messages.build(
      { event: EVENT.QUEUED, position: 1, speciality: "General Physician" },
      locale
    );
    assert.doesNotMatch(body, /undefined|null|NaN/);
  }
});

test("the doctor announcement flags urgency and carries the queue depth", () => {
  const urgent = messages.build(
    { event: EVENT.NEW_CASE, speciality: "Cardiology", emergencyLevel: "CRITICAL", waiting: 4 },
    "en"
  );
  assert.match(urgent.title, /Urgent/);
  assert.match(urgent.title, /Cardiology/);
  assert.match(urgent.body, /CRITICAL/);
  assert.match(urgent.body, /4 patients/);

  const routine = messages.build(
    { event: EVENT.NEW_CASE, speciality: "Cardiology", emergencyLevel: "LOW", waiting: 1 },
    "en"
  );
  assert.doesNotMatch(routine.title, /Urgent/);
  assert.match(routine.title, /New case/);
  assert.match(routine.body, /1 patient\b/);
});

test("HIGH counts as urgent to a doctor, MEDIUM does not", () => {
  const high = messages.build({ event: EVENT.NEW_CASE, speciality: "X", emergencyLevel: "HIGH" }, "en");
  const medium = messages.build({ event: EVENT.NEW_CASE, speciality: "X", emergencyLevel: "MEDIUM" }, "en");
  assert.match(high.title, /Urgent/);
  assert.doesNotMatch(medium.title, /Urgent/);
});

test("the doctor announcement carries no clinical content", () => {
  // A doctor is told there is a CRITICAL case waiting, never what is wrong with
  // the patient — that is behind the authenticated queue list (LLD §13.3).
  const payload = {
    event: EVENT.NEW_CASE,
    doctorUuid: "doc-1",
    queueEntryId: 9,
    speciality: "Cardiology",
    emergencyLevel: "CRITICAL",
    waiting: 2,
  };
  const { title, body } = messages.build(payload, "en");
  const data = messages.toDataPayload(payload);

  const rendered = `${title} ${body} ${JSON.stringify(data)}`;
  assert.doesNotMatch(rendered, /chiefComplaint|complaint|vitals|spo2|symptom/i);
});

test("an unrecognised event still produces a sane message", () => {
  const { title, body } = messages.build({ event: "queue:something_new" }, "en");
  assert.ok(title.length > 0);
  assert.equal(body, "queue:something_new");
});

test("FCM data values are all strings — FCM rejects anything else", () => {
  const data = messages.toDataPayload({
    event: EVENT.POSITION,
    queueEntryId: 42,
    position: 3,
    etaMinutes: 30,
    tier: "IMMEDIATE",
    escalated: false,
    speciality: "General Physician",
  });

  for (const [key, value] of Object.entries(data)) {
    assert.equal(typeof value, "string", `data.${key} is ${typeof value}, not a string`);
  }
  assert.equal(data.queueEntryId, "42");
  assert.equal(data.escalated, "false");
  assert.equal(data.speciality, "General Physician", "strings must not be double-encoded");
});

test("null and undefined are dropped from the data payload, not stringified", () => {
  const data = messages.toDataPayload({
    event: EVENT.READY,
    queueEntryId: 1,
    assignedDoctorUuid: null,
    reason: undefined,
  });
  assert.ok(!("assignedDoctorUuid" in data));
  assert.ok(!("reason" in data));
});

test("a doctor panel payload is summarised, never shipped whole", () => {
  // cases[] can hold chief complaint and vitals — it must not ride along in a
  // push payload (LLD §13.3), and FCM caps the data payload at 4KB anyway.
  const data = messages.toDataPayload({
    event: EVENT.DOCTOR_QUEUE_UPDATE,
    speciality: "Cardiology",
    cases: [
      { queueEntryId: 1, chiefComplaint: "chest pain" },
      { queueEntryId: 2, chiefComplaint: "fever" },
    ],
  });

  assert.equal(data.caseCount, "2");
  assert.ok(!("cases" in data));
  assert.doesNotMatch(JSON.stringify(data), /chest pain|fever/);
});
