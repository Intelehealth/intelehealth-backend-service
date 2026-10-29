const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

// call_data.service with the database models replaced by an in-memory call_data table.
const PORTAL = path.resolve(__dirname, "..");
const { Op } = require("sequelize");
const logs = [];
const table = { rows: [], failNext: null };

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if (value[Op.in]) return value[Op.in].includes(row[key]);
      if (value[Op.gte]) return row[key] >= value[Op.gte];
    }
    return (row[key] ?? null) === value;
  });
}

const call_data = {
  create: async (data) => {
    const row = { id: table.rows.length + 1, createdAt: new Date(), ...data };
    table.rows.push(row);
    return row;
  },
  findOne: async ({ where }) => table.rows.filter((r) => matches(r, where)).sort((a, b) => b.id - a.id)[0] || null,
  update: async (values, { where }) => {
    if (table.failNext) {
      const error = table.failNext;
      table.failNext = null;
      throw error;
    }
    const hit = table.rows.filter((r) => matches(r, where));
    hit.forEach((r) => Object.assign(r, values));
    return [hit.length];
  },
};

function stub(relative, exports) {
  const file = require.resolve(path.join(PORTAL, relative));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub("models", { call_data });
stub("openmrs_models", { Sequelize: { Op }, sequelize: {} });
stub("controllers/queries", { locationQuery: "" });
stub("logger/index", { logStream: (type, message) => logs.push(`${type}: ${message}`) });

const service = require("../services/call_data.service");
const { CALL_OUTCOMES } = require("../constants/call-outcomes");

const IST_MS = 5.5 * 60 * 60 * 1000;
const ist = (ms) => new Date(ms + IST_MS);

function ringingRow(overrides = {}) {
  const now = Date.now();
  return { id: 1, call_status: "calling", reason: null, start_time: ist(now - 20000), connected_at: null, end_time: null, createdAt: new Date(now - 20000), ...overrides };
}

test("connected sets success, reason and connected_at, and only once", () => {
  const now = Date.now();
  const changes = service.outcomeChanges(ringingRow(), "connected", now);
  assert.deepEqual(changes, { call_status: "success", reason: "Call connected successfully", connected_at: ist(now) });
  assert.equal(service.outcomeChanges(ringingRow({ call_status: "success", connected_at: ist(now) }), "connected", now), null);
});

test("call duration counts connected time, not ringing", () => {
  const now = Date.now();
  const row = ringingRow({ call_status: "success", start_time: ist(now - 120000), connected_at: ist(now - 90000) });
  const changes = service.outcomeChanges(row, "doctorEnded", now);
  assert.equal(changes.call_status, "success");
  assert.equal(changes.reason, "Doctor ended the call");
  assert.equal(changes.call_duration, 90);
  assert.deepEqual(changes.end_time, ist(now));
});

test("an end without a recorded connection falls back to start_time and logs it", () => {
  const now = Date.now();
  const changes = service.outcomeChanges(ringingRow({ start_time: ist(now - 30000) }), "endedNormally", now);
  assert.equal(changes.call_duration, 30);
  assert.ok(logs.some((l) => l.includes("without a recorded connection")));
});

test("unanswered, rejected and failed attempts end with zero duration", () => {
  for (const [outcome, status, reason] of [
    ["noAnswer", "no_answer", "HW not answering"],
    ["hwRejected", "rejected", "HW rejected the call"],
    ["livekitFailed", "failure", "LiveKit connection failed"],
    ["networkUnavailable", "failure", "Network unavailable"],
    ["unknown", "unknown", "Call outcome could not be determined"],
  ]) {
    const changes = service.outcomeChanges(ringingRow(), outcome);
    assert.equal(changes.call_status, status, outcome);
    assert.equal(changes.reason, reason, outcome);
    assert.equal(changes.call_duration, 0, outcome);
    assert.ok(changes.end_time instanceof Date, outcome);
  }
});

test("doctor cancel within 5 seconds is an immediate cancel", () => {
  const now = Date.now();
  assert.equal(service.outcomeChanges(ringingRow({ createdAt: new Date(now - 3000) }), "doctorCancelled", now).reason, "Doctor cancelled the call immediately");
  const later = service.outcomeChanges(ringingRow({ createdAt: new Date(now - 15000) }), "doctorCancelled", now);
  assert.equal(later.call_status, "cancelled");
  assert.equal(later.reason, "Doctor cancelled the call");
});

test("a delivery issue recorded while ringing becomes the outcome of an unanswered call", () => {
  const row = ringingRow();
  Object.assign(row, service.outcomeChanges(row, "hwNotAvailable"));
  assert.equal(row.call_status, "calling");
  assert.equal(row.reason, "HW not available");
  assert.equal(row.end_time, null);

  // A stronger issue replaces a weaker one, not the other way round.
  Object.assign(row, service.outcomeChanges(row, "pushFailed"));
  assert.equal(row.reason, "Push notification delivery failed");
  assert.equal(service.outcomeChanges(row, "hwNotAvailable"), null);

  const end = service.outcomeChanges(row, "noAnswer");
  assert.equal(end.call_status, "failure");
  assert.equal(end.reason, "Push notification delivery failed");
});

test("an issue only replaces the outcomes it explains", () => {
  const micRow = ringingRow({ reason: "Doctor microphone permission denied", createdAt: new Date(Date.now() - 20000) });
  assert.deepEqual(
    [service.outcomeChanges(micRow, "doctorCancelled").call_status, service.outcomeChanges(micRow, "doctorCancelled").reason],
    ["failure", "Doctor microphone permission denied"]
  );
  assert.equal(service.outcomeChanges(micRow, "noAnswer").reason, "HW not answering");

  const pushRow = ringingRow({ reason: "Push notification delivery failed", createdAt: new Date(Date.now() - 20000) });
  assert.equal(service.outcomeChanges(pushRow, "doctorCancelled").call_status, "cancelled");
  assert.equal(service.outcomeChanges(pushRow, "hwRejected").call_status, "rejected");
});

test("a connected call ignores issues and pre-connection outcomes that arrive late", () => {
  const row = ringingRow({ call_status: "success", connected_at: ist(Date.now() - 5000) });
  assert.equal(service.outcomeChanges(row, "pushFailed"), null);
  assert.equal(service.outcomeChanges(row, "noAnswer"), null);
  assert.equal(service.outcomeChanges(row, "doctorCancelled"), null);
  assert.equal(service.outcomeChanges(row, "unknown"), null);
  assert.equal(service.outcomeChanges(row, "callDropped").call_status, "disconnected");
});

test("final rows, including legacy failures without end_time, never change", () => {
  const ended = ringingRow({ call_status: "success", end_time: ist(Date.now()) });
  const legacyFailure = ringingRow({ call_status: "failure", reason: "No internet", end_time: null });
  for (const outcome of Object.keys(CALL_OUTCOMES)) {
    assert.equal(service.outcomeChanges(ended, outcome), null, outcome);
    assert.equal(service.outcomeChanges(legacyFailure, outcome), null, outcome);
  }
});

test("every reason is unique, so each has one spelling", () => {
  const reasons = Object.values(CALL_OUTCOMES).map((o) => o.reason);
  assert.equal(new Set(reasons).size, reasons.length);
  for (const outcome of Object.values(CALL_OUTCOMES)) {
    assert.ok(outcome.reason.length <= 255);
  }
});

test("updateCallRecordOfWebrtc writes the row and ignores a repeat", async () => {
  table.rows = [];
  const created = await service.createCallRecordOfWebrtc("doctor", "hw", "room", null, "calling", "audio");
  assert.equal(created.success, true);
  assert.equal(created.data.visit_id, null);
  assert.equal(created.data.call_type, "audio");

  await service.updateCallRecordOfWebrtc({ recordId: created.data.id, outcome: "hwRejected" });
  assert.equal(table.rows[0].call_status, "rejected");
  const repeat = await service.updateCallRecordOfWebrtc({ recordId: created.data.id, outcome: "noAnswer" });
  assert.equal(repeat.ignored, true);
  assert.equal(table.rows[0].reason, "HW rejected the call");
});

test("findOpen locates the row when only doctor and room are known", async () => {
  table.rows = [];
  await service.createCallRecordOfWebrtc("doctor", "hw", "room-1", "visit", "calling", "video");
  await service.updateCallRecordOfWebrtc({ doctorId: "doctor", roomId: "room-1", outcome: "connected", findOpen: true });
  assert.equal(table.rows[0].call_status, "success");
  assert.equal(await service.getOpenCallStatus(table.rows[0].id), "success");
});

test("a database error is logged and returned, not turned into a call outcome", async () => {
  table.rows = [];
  const created = await service.createCallRecordOfWebrtc("doctor", "hw", "room", "visit", "calling", "video");
  table.failNext = new Error("Lock wait timeout exceeded");
  const result = await service.updateCallRecordOfWebrtc({ recordId: created.data.id, outcome: "connected" });
  assert.equal(result.success, false);
  assert.equal(table.rows[0].call_status, "calling");
  assert.equal(table.rows[0].reason, null);
  assert.ok(logs.some((l) => l.includes("Lock wait timeout exceeded")));
});

test("a missing row and an unknown outcome key are logged, not thrown", async () => {
  table.rows = [];
  assert.equal((await service.updateCallRecordOfWebrtc({ recordId: 99, outcome: "noAnswer" })).success, false);
  assert.equal((await service.updateCallRecordOfWebrtc({ recordId: 99, outcome: "HW_NOT_ANSWERING" })).success, false);
  assert.ok(logs.some((l) => l.includes("no call_data row for record 99")));
  assert.ok(logs.some((l) => l.includes("unknown call outcome HW_NOT_ANSWERING")));
});

test("a row changed by another event between read and write is not overwritten", async () => {
  table.rows = [];
  const created = await service.createCallRecordOfWebrtc("doctor", "hw", "room", "visit", "calling", "video");
  const original = call_data.findOne;
  call_data.findOne = async (query) => {
    const row = await original(query);
    const snapshot = row && { ...row };
    if (row) Object.assign(row, { call_status: "rejected", end_time: ist(Date.now()) });
    return snapshot;
  };
  try {
    const result = await service.updateCallRecordOfWebrtc({ recordId: created.data.id, outcome: "noAnswer" });
    assert.equal(result.ignored, true);
    assert.equal(table.rows[0].call_status, "rejected");
  } finally {
    call_data.findOne = original;
  }
});

test("createClosedCallRecord stores an attempt that never reached the HW", async () => {
  table.rows = [];
  const result = await service.createClosedCallRecord({ doctorId: "doctor", nurseId: "hw", roomId: "room", visitId: "visit", callType: "bogus", outcome: "initiationApiFailed" });
  const row = table.rows[0];
  assert.equal(result.success, true);
  assert.equal(row.call_status, "failure");
  assert.equal(row.reason, "Call initiation API failed");
  assert.equal(row.call_duration, 0);
  assert.deepEqual(row.start_time, row.end_time);
  assert.equal(row.call_type, undefined, "invalid call type falls back to the column default");
});
