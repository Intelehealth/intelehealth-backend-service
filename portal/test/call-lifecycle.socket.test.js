const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

// Drives handlers/socket.js and services/webrtc.service.js with fake sockets, an in-memory
// call_data table and a fake push sender; call_data.service is the real one.
const PORTAL = path.resolve(__dirname, "..");
const { Op } = require("sequelize");

test.mock.timers.enable({ apis: ["setTimeout"] });

const rows = [];
const db = { failCreate: false };
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
    if (db.failCreate) throw new Error("ER_LOCK_WAIT_TIMEOUT");
    const row = { id: rows.length + 1, createdAt: new Date(), call_type: "video", ...data };
    if (row.call_type === undefined) row.call_type = "video";
    rows.push(row);
    return row;
  },
  findOne: async ({ where }) => rows.filter((r) => matches(r, where)).sort((a, b) => b.id - a.id)[0] || null,
  update: async (values, { where }) => {
    const hit = rows.filter((r) => matches(r, where));
    hit.forEach((r) => Object.assign(r, values));
    return [hit.length];
  },
};

const pushTokens = {};
const push = { result: "ok", sent: [] };
const logs = [];
function stub(relative, exports) {
  const file = require.resolve(path.join(PORTAL, relative));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub("models", {
  call_data,
  user_settings: { findOne: async ({ where }) => (pushTokens[where.user_uuid] ? { device_reg_token: pushTokens[where.user_uuid] } : null) },
  sequelize: {},
});
stub("openmrs_models", { Sequelize: { Op }, sequelize: {} });
stub("controllers/queries", { locationQuery: "" });
stub("logger/index", { logStream: (type, message) => logs.push(`${type}: ${message}`) });
stub("handlers/helper", {
  getFirebaseAdmin: () => ({ database: () => ({ ref: () => ({}) }) }),
  sendCloudNotification: async (payload) => {
    push.sent.push(payload);
    if (push.result === "throw") return undefined;
    if (push.result === "ok") return { responses: [{ success: true }] };
    return { responses: [{ success: false, error: { code: push.result } }] };
  },
});
stub("services/message.service", { deliveredById: () => {} });
stub("handlers/ai-ddx-socket", { registerAiDdxSocket: () => {} });

const emitted = [];
function namespace(name) {
  const ns = { name, handlers: {} };
  ns.on = (event, fn) => { ns.handlers[event] = fn; };
  ns.to = (id) => ({ emit: (event, data) => emitted.push({ to: id, event, data }) });
  ns.emit = () => {};
  return ns;
}
const io = namespace("/");
const namespaces = {};
io.sockets = { emit: () => {}, to: io.to, adapter: { rooms: {} }, in: () => ({ emit: () => {} }) };
io.of = (name) => (namespaces[name] = namespaces[name] || namespace(name));
const socketIo = require.resolve("socket.io", { paths: [PORTAL] });
require.cache[socketIo] = { id: socketIo, filename: socketIo, loaded: true, exports: () => io };
process.env.DOMAIN = process.env.DOMAIN || "test.local";

require("../handlers/socket.js")({});
global.io = io;
require("../services/webrtc.service.js")();

let socketSeq = 0;
function connect(userId, ns = io) {
  const handlers = {};
  const socket = {
    id: `${ns.name}#${++socketSeq}`,
    handshake: { query: { userId, name: userId } },
    on: (event, fn) => { handlers[event] = fn; },
    join: () => {},
    emit: () => {},
  };
  ns.handlers.connection(socket);
  return { id: socket.id, fire: async (event, data) => { await handlers[event](data); await flush(); } };
}
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };
const advance = async (ms) => { test.mock.timers.tick(ms); await flush(); };

let seq = 0;
/** A doctor, a HW whose app is online (unless offline), and the doctor's call to them. */
async function placeCall({ hwOnline = true, callType = "video", token = "hw-token", attempt = true, visitId } = {}) {
  const n = ++seq;
  const doctorId = `doctor-${n}`, hwId = `hw-${n}`, roomId = `room-${n}`;
  const callAttemptId = attempt ? `attempt-${n}` : undefined;
  if (token) pushTokens[hwId] = token;
  const app = hwOnline ? connect(hwId) : null;
  const doctor = connect(doctorId);
  const ids = { nurseId: hwId, doctorName: "Dr", roomId, visitId: visitId === undefined ? `visit-${n}` : visitId, doctorId, socketId: doctor.id, initiator: "dr", callType, callAttemptId };
  await doctor.fire("call", ids);
  return { doctor, app, ids, row: rows[rows.length - 1], rowCount: rows.length };
}
const connected = (call) => call.doctor.fire("call-connected", { ...call.ids, socketId: call.doctor.id });
const bye = (call, extra = {}) => call.doctor.fire("bye", { ...call.ids, socketId: call.doctor.id, webapp: true, ...extra });
const ageRow = (row, ms) => { row.createdAt = new Date(row.createdAt.getTime() - ms); };

test("successful video call: connected, then ended by the doctor", async () => {
  const call = await placeCall();
  assert.equal(call.row.call_status, "calling");
  assert.equal(call.row.reason, null);
  assert.ok(call.row.start_time instanceof Date);

  await connected(call);
  assert.equal(call.row.call_status, "success");
  assert.equal(call.row.reason, "Call connected successfully");
  assert.ok(call.row.connected_at instanceof Date);
  call.row.connected_at = new Date(call.row.connected_at.getTime() - 42000);

  await bye(call, { endedBy: "doctor" });
  assert.equal(call.row.call_status, "success");
  assert.equal(call.row.reason, "Doctor ended the call");
  assert.equal(call.row.call_duration, 42);
  assert.ok(call.row.end_time instanceof Date);
});

test("audio call is stored as audio", async () => {
  const call = await placeCall({ callType: "audio" });
  assert.equal(call.row.call_type, "audio");
});

test("HW does not answer before the 60 s timeout", async () => {
  const call = await placeCall();
  await call.doctor.fire("call_time_up", call.ids.nurseId);
  assert.equal(call.row.call_status, "no_answer");
  assert.equal(call.row.reason, "HW not answering");
  assert.equal(call.row.call_duration, 0);
  assert.ok(call.row.end_time instanceof Date);
});

test("HW app offline and no push token", async () => {
  const call = await placeCall({ hwOnline: false, token: null });
  assert.equal(call.row.reason, "Push notification delivery failed");
  assert.equal(call.row.call_status, "calling");
  await call.doctor.fire("call_time_up", call.ids.nurseId);
  assert.equal(call.row.call_status, "failure");
  assert.equal(call.row.reason, "Push notification delivery failed");
});

test("push provider results map to delivery reasons when the HW app is offline", async () => {
  for (const [result, reason] of [
    ["messaging/registration-token-not-registered", "Push notification delivery failed"],
    ["messaging/internal-error", "Push notification delivery failed"],
    ["throw", "Push notification delivery failed"],
    ["ok", "HW not available"],
  ]) {
    push.result = result;
    const call = await placeCall({ hwOnline: false });
    await call.doctor.fire("call_time_up", call.ids.nurseId);
    assert.equal(call.row.call_status, "failure", result);
    assert.equal(call.row.reason, reason, result);
  }
  push.result = "ok";
});

test("a push failure is not the outcome when the HW app got the call over its socket", async () => {
  push.result = "messaging/internal-error";
  const call = await placeCall({ hwOnline: true });
  push.result = "ok";
  assert.equal(call.row.reason, null);
  await call.doctor.fire("call_time_up", call.ids.nurseId);
  assert.equal(call.row.call_status, "no_answer");
});

test("the HW's own push token is used", async () => {
  push.sent = [];
  const call = await placeCall({ token: "token-of-this-hw" });
  assert.deepEqual(push.sent[0].regTokens, ["token-of-this-hw"]);
  assert.equal(push.sent[0].data.device_token, "token-of-this-hw");
  assert.ok(Object.values(push.sent[0].data).every((v) => typeof v === "string"), "FCM data must be strings");
  assert.ok(call.row);
});

test("HW rejects the call", async () => {
  const call = await placeCall();
  await call.app.fire("hw_call_reject", call.ids.doctorId);
  assert.equal(call.row.call_status, "rejected");
  assert.equal(call.row.reason, "HW rejected the call");
  assert.ok(emitted.some((e) => e.to === call.doctor.id && e.event === "hw_call_reject"));
  assert.equal(global.users[call.app.id].callStatus, "available", "HW is free again, as after the old bye");
  assert.equal(global.users[call.app.id].room, null);
});

test("doctor reconnects during a connected call: call stays open, new socket state untouched", async () => {
  const call = await placeCall();
  await connected(call);
  await call.doctor.fire("disconnect", "transport error");
  const doctor2 = connect(call.ids.doctorId);
  await advance(30000);
  assert.equal(call.row.call_status, "success");
  assert.equal(call.row.end_time, null);
  assert.equal(global.users[doctor2.id].callStatus, "available");
  assert.equal(global.users[doctor2.id].recordId, undefined);
  await doctor2.fire("bye", { ...call.ids, socketId: doctor2.id, webapp: true, endedBy: "doctor" });
  assert.equal(call.row.reason, "Doctor ended the call");
});

test("doctor cancels before the HW was called: one cancelled row, even if repeated", async () => {
  const doctor = connect("doctor-immediate");
  const payload = { callAttemptId: "attempt-immediate", visitId: "visit-i", doctorId: "doctor-immediate", roomId: "room-i", nurseId: "hw-i", callType: "audio", webapp: true, initiator: "dr" };
  const before = rows.length;
  await doctor.fire("cancel_dr", payload);
  await doctor.fire("cancel_dr", payload);
  assert.equal(rows.length, before + 1);
  const row = rows[rows.length - 1];
  assert.equal(row.call_status, "cancelled");
  assert.equal(row.reason, "Doctor cancelled the call immediately");
  assert.equal(row.call_type, "audio");
  assert.ok(row.end_time instanceof Date);
});

test("doctor cancels within 5 s of placing the call", async () => {
  const call = await placeCall();
  await call.doctor.fire("cancel_dr", { ...call.ids, webapp: true });
  assert.equal(call.row.call_status, "cancelled");
  assert.equal(call.row.reason, "Doctor cancelled the call immediately");
  assert.ok(emitted.some((e) => e.to === call.app.id && e.event === "cancel_dr"), "phone told to stop ringing");
});

test("doctor cancels while the phone rings", async () => {
  const call = await placeCall();
  ageRow(call.row, 20000);
  await call.doctor.fire("cancel_dr", { ...call.ids, webapp: true });
  assert.equal(call.row.call_status, "cancelled");
  assert.equal(call.row.reason, "Doctor cancelled the call");
  await call.doctor.fire("cancel_dr", { ...call.ids, webapp: true });
  assert.equal(call.row.reason, "Doctor cancelled the call");
});

test("microphone denied, then the doctor cancels", async () => {
  const call = await placeCall();
  ageRow(call.row, 20000);
  await call.doctor.fire("call_outcome", { ...call.ids, outcome: "micDenied" });
  assert.equal(call.row.call_status, "calling");
  await call.doctor.fire("cancel_dr", { ...call.ids, webapp: true });
  assert.equal(call.row.call_status, "failure");
  assert.equal(call.row.reason, "Doctor microphone permission denied");
});

test("a token API failure before the HW is called creates one failed row", async () => {
  const doctor = connect("doctor-token");
  const before = rows.length;
  await doctor.fire("call_outcome", { callAttemptId: "attempt-token", visitId: "v", doctorId: "doctor-token", roomId: "r", nurseId: "h", callType: "video", outcome: "initiationApiFailed" });
  await doctor.fire("call_outcome", { callAttemptId: "attempt-token", visitId: "v", doctorId: "doctor-token", roomId: "r", nurseId: "h", callType: "video", outcome: "initiationApiFailed" });
  assert.equal(rows.length, before + 1);
  assert.equal(rows[rows.length - 1].call_status, "failure");
  assert.equal(rows[rows.length - 1].reason, "Call initiation API failed");
});

test("unknown outcome keys from the webapp are ignored", async () => {
  const call = await placeCall();
  await call.doctor.fire("call_outcome", { ...call.ids, outcome: "connected" });
  await call.doctor.fire("call_outcome", { ...call.ids, outcome: "<b>anything</b>" });
  assert.equal(call.row.call_status, "calling");
  assert.equal(call.row.reason, null);
});

test("LiveKit drops the doctor while ringing", async () => {
  const call = await placeCall();
  await call.doctor.fire("call_outcome", { ...call.ids, outcome: "livekitFailed" });
  assert.equal(call.row.call_status, "failure");
  assert.equal(call.row.reason, "LiveKit connection failed");
});

test("doctor's network lost while ringing, no reconnect", async () => {
  const call = await placeCall();
  await call.doctor.fire("disconnect", "ping timeout");
  assert.equal(call.row.call_status, "calling", "waits for a reconnect first");
  await advance(5000);
  assert.equal(call.row.call_status, "failure");
  assert.equal(call.row.reason, "Network unavailable");
});

test("doctor's socket reconnects while ringing: the call carries on", async () => {
  const call = await placeCall();
  await call.doctor.fire("disconnect", "transport error");
  const doctor2 = connect(call.ids.doctorId);
  await advance(5000);
  assert.equal(call.row.call_status, "calling");
  await doctor2.fire("call_time_up", call.ids.nurseId);
  assert.equal(call.row.call_status, "no_answer");
});

test("network lost during a connected call, no reconnect", async () => {
  const call = await placeCall();
  await connected(call);
  await call.doctor.fire("disconnect", "ping timeout");
  await advance(5000);
  assert.equal(call.row.call_status, "success", "connected calls get a longer grace period");
  await advance(25000);
  assert.equal(call.row.call_status, "disconnected");
  assert.equal(call.row.reason, "Call disconnected due to network loss");
});

test("connected call ended by LiveKit dropping the room", async () => {
  const call = await placeCall();
  await connected(call);
  await bye(call, { endedBy: "dropped" });
  assert.equal(call.row.call_status, "disconnected");
  assert.equal(call.row.reason, "Call dropped unexpectedly");
});

test("HW hangs up from the app, then the webapp's bye arrives", async () => {
  const call = await placeCall();
  await connected(call);
  await call.app.fire("bye", { ...call.ids, socketId: call.doctor.id });
  assert.equal(call.row.reason, "HW ended the call");
  await bye(call, { endedBy: "hw" });
  assert.equal(call.row.reason, "HW ended the call", "later bye does not overwrite");
});

test("out-of-order: call-connected after the call already ended", async () => {
  const call = await placeCall();
  await call.app.fire("hw_call_reject", call.ids.doctorId);
  await connected(call);
  assert.equal(call.row.call_status, "rejected");
});

test("a call with no outcome is recorded as unknown after 11 minutes", async () => {
  const call = await placeCall();
  await advance(11 * 60 * 1000);
  assert.equal(call.row.call_status, "unknown");
  assert.equal(call.row.reason, "Call outcome could not be determined");
});

test("a connected call is not marked unknown", async () => {
  const call = await placeCall();
  await connected(call);
  await advance(11 * 60 * 1000);
  assert.equal(call.row.call_status, "success");
});

test("missing optional ids and an unknown socket do not throw", async () => {
  const call = await placeCall({ visitId: null, attempt: false });
  assert.equal(call.row.visit_id, null);
  await call.doctor.fire("bye", { socketId: "gone", nurseId: call.ids.nurseId });
  await call.doctor.fire("call-connected", { initiator: "dr", socketId: "gone" });
  await call.doctor.fire("cancel_dr", {});
  await call.doctor.fire("call_time_up", undefined);
  await call.doctor.fire("call_outcome", undefined);
});

test("calls the HW started are not written to call_data", async () => {
  const call = await placeCall();
  await connected(call);
  await bye(call, { endedBy: "doctor" });
  const finished = { ...call.row };
  await call.doctor.fire("call-connected", { initiator: "hw", socketId: call.doctor.id });
  await call.doctor.fire("bye", { initiator: "hw", socketId: call.doctor.id, webapp: true });
  await call.app.fire("cancel_hw", { connectToDrId: call.ids.doctorId });
  assert.deepEqual(call.row, finished);
});

test("the /hw socket relays the call without a second row", async () => {
  const before = rows.length;
  const hwWebapp = connect("hw-person", io.of("/hw"));
  await hwWebapp.fire("call", { nurseId: "hw-person", doctorName: "Dr", roomId: "room-hw", doctorId: "d", callType: "video" });
  assert.equal(rows.length, before);
  await hwWebapp.fire("disconnect", "transport close");
});

test("a failed row insert is logged, and later events do not crash", async () => {
  db.failCreate = true;
  const before = rows.length;
  const doctor = connect("doctor-dbfail");
  await doctor.fire("call", { nurseId: "hw-dbfail", roomId: "room-dbfail", visitId: "v", doctorId: "doctor-dbfail", socketId: doctor.id, initiator: "dr", callType: "video", callAttemptId: "attempt-dbfail" });
  db.failCreate = false;
  await doctor.fire("cancel_dr", { nurseId: "hw-dbfail", callAttemptId: "attempt-dbfail", doctorId: "doctor-dbfail", roomId: "room-dbfail" });
  assert.equal(rows.length, before);
  assert.ok(logs.some((l) => l.includes("ER_LOCK_WAIT_TIMEOUT")));
});
