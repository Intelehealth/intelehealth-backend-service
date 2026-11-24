const test = require("node:test");
const assert = require("node:assert/strict");
const { database, openMrsDatabase } = require("../database");
const aiMiddleware = require("../crons/services/ai-middleware.service");
const { computeForVisit, recordFailure } = require("../database/ai-ddx-result.repository");

const visitRows = [{
  visit_id: 7, visit_uuid: "visit-1", patient_uuid: "patient-1", gender: "F", birthdate: "1990-01-01",
  obs_id: 1, value_text: "fever", value_numeric: null, encounter_type_name: "ADULTINITIAL",
  concept_name: "CURRENT COMPLAINT", locale_preferred: 1, concept_name_type: "FULLY_SPECIFIED",
}];

const setup = (t, { existing = null, visit = visitRows } = {}) => {
  const writes = [];
  t.mock.method(openMrsDatabase, "query", async () => [visit]);
  t.mock.method(database, "query", async (sql, params) => {
    if (sql.startsWith("SELECT * FROM ai_ddx_results")) return [existing ? [existing] : []];
    writes.push({ sql, params });
    return [{ affectedRows: 1 }];
  });
  return writes;
};

const failOnce = async (t, options) => {
  const writes = setup(t, options);
  const error = await computeForVisit("visit-1").catch((err) => err);
  await recordFailure("visit-1", error);
  return writes.at(-1);
};

test("a middleware error stores the payload, patient and error response on the failed row", async (t) => {
  t.mock.method(aiMiddleware, "ddx", async () => {
    const err = new Error('AI middleware responded 500: {"error":"Request to AI model failed"}');
    err.responseBody = { status: 500, body: { error: "Request to AI model failed" } };
    throw err;
  });
  const { sql, params } = await failOnce(t);

  assert.match(sql, /^INSERT INTO ai_ddx_results/);
  assert.equal(params.status, "failed");
  assert.equal(params.patient_uuid, "patient-1");
  assert.match(params.request_payload, /fever/i);
  assert.match(params.payload_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(JSON.parse(params.response), { status: 500, body: { error: "Request to AI model failed" } });
  assert.match(params.error, /responded 500/);
});

test("a 200 without a usable result keeps that response for inspection", async (t) => {
  t.mock.method(aiMiddleware, "ddx", async () => ({ result: { data: null }, note: "empty" }));
  const { params } = await failOnce(t);

  assert.deepEqual(JSON.parse(params.response), { result: { data: null }, note: "empty" });
  assert.match(params.request_payload, /fever/i);
});

test("a timeout has no response but still records the payload", async (t) => {
  t.mock.method(aiMiddleware, "ddx", async () => { throw new Error("AI middleware request timed out after 60000ms"); });
  const { params } = await failOnce(t);

  assert.equal(params.response, null);
  assert.match(params.request_payload, /fever/i);
});

test("a retry updates the same row and keeps earlier details when this failure has none", async (t) => {
  const existing = { id: 9, visit_uuid: "visit-1", status: "failed", attempts: 1 };
  const { sql, params } = await failOnce(t, { existing, visit: [] });

  assert.match(sql, /^UPDATE ai_ddx_results SET/);
  assert.match(sql, /request_payload = COALESCE\(:request_payload, request_payload\)/);
  assert.equal(params.id, 9);
  assert.equal(params.attempts, 2);
  assert.equal(params.request_payload, null);
  assert.match(params.error, /Visit visit-1 not found/);
});

test("a notes-based row is never recomputed by the worker", async (t) => {
  const writes = setup(t, { existing: { id: 9, status: "done", source: "notes", payload_hash: "x", attempts: 2 } });
  const ddx = t.mock.method(aiMiddleware, "ddx", async () => ({ result: { data: { result: [] } } }));

  assert.deepEqual(await computeForVisit("visit-1"), { skipped: true });
  assert.equal(ddx.mock.callCount(), 0);
  assert.equal(writes.length, 0);
});

test("a worker success never overwrites a row that became notes-based mid-flight", async (t) => {
  const writes = setup(t, { existing: { id: 9, status: "done", source: "precompute", payload_hash: "old", attempts: 1 } });
  t.mock.method(aiMiddleware, "ddx", async () => ({ result: { data: { result: [{ diagnosis: "flu" }] } } }));

  await computeForVisit("visit-1");
  const { sql, params } = writes.at(-1);
  assert.match(sql, /WHERE id = :id AND source <> :notesSource/);
  assert.equal(params.notesSource, "notes");
});

test("a worker insert yields to a notes row created mid-flight", async (t) => {
  const writes = setup(t);
  t.mock.method(aiMiddleware, "ddx", async () => ({ result: { data: { result: [{ diagnosis: "flu" }] } } }));

  await computeForVisit("visit-1");
  assert.match(writes.at(-1).sql, /ON DUPLICATE KEY UPDATE visit_uuid = visit_uuid/);
});

test("a worker failure never marks a notes-based row failed", async (t) => {
  t.mock.method(aiMiddleware, "ddx", async () => { throw new Error("boom"); });
  const { sql, params } = await failOnce(t, { existing: { id: 9, status: "done", source: "precompute", attempts: 1 } });

  assert.match(sql, /WHERE id = :id AND source <> :notesSource/);
  assert.equal(params.notesSource, "notes");
});

const aiLlmFeature = require("../crons/services/ai-llm-feature.service");

const summaryObj = { extraction: { chief_complaint: "fever" } };
const jsonRow = (value) => ({
  visit_id: 7, visit_uuid: "visit-1", patient_uuid: "patient-1", gender: "F", birthdate: "1990-01-01",
  obs_id: 2, value_text: value, value_numeric: null, encounter_type_name: "ADULTINITIAL",
  concept_uuid: "1f770363-262e-4d01-b1df-3eb164d575ef",
  concept_name: "JSON Format Visit Summary", locale_preferred: 1, concept_name_type: "FULLY_SPECIFIED",
});
const withFlags = (t, flags) => t.mock.method(aiLlmFeature, "getPublishedAiLlmFlags", async () => flags);
const allOn = { json_format_visit_summary: true, json_format_visit_summary_ddx: true };

test("both flags on with the obs present sends the parsed object and stores a string payload", async (t) => {
  withFlags(t, allOn);
  const writes = setup(t, { visit: [...visitRows, jsonRow(JSON.stringify(summaryObj))] });
  const ddx = t.mock.method(aiMiddleware, "ddx", async () => ({ result: { data: { result: [{ diagnosis: "flu" }] } } }));
  t.mock.method(console, "log", () => {});

  await computeForVisit("visit-1");
  assert.deepEqual(ddx.mock.calls[0].arguments[0].casehistory, summaryObj);
  const { params } = writes.at(-1);
  assert.equal(typeof params.request_payload, "string");
  assert.equal(params.request_payload, JSON.stringify(summaryObj));
  assert.equal(params.payload_hash, require("../crons/services/ddx-payload.service").hashPayload(summaryObj));
});

test("parent on with the ddx child off sends the string", async (t) => {
  withFlags(t, { json_format_visit_summary: true, json_format_visit_summary_ddx: false });
  setup(t, { visit: [...visitRows, jsonRow(JSON.stringify(summaryObj))] });
  const ddx = t.mock.method(aiMiddleware, "ddx", async () => ({ result: { data: { result: [] } } }));
  t.mock.method(console, "log", () => {});

  await computeForVisit("visit-1");
  assert.equal(typeof ddx.mock.calls[0].arguments[0].casehistory, "string");
});

test("parent off with the ddx child on sends the string", async (t) => {
  withFlags(t, { json_format_visit_summary: false, json_format_visit_summary_ddx: true });
  setup(t, { visit: [...visitRows, jsonRow(JSON.stringify(summaryObj))] });
  const ddx = t.mock.method(aiMiddleware, "ddx", async () => ({ result: { data: { result: [] } } }));
  t.mock.method(console, "log", () => {});

  await computeForVisit("visit-1");
  assert.equal(typeof ddx.mock.calls[0].arguments[0].casehistory, "string");
});

test("both flags on with the obs missing sends the string", async (t) => {
  withFlags(t, allOn);
  setup(t);
  const ddx = t.mock.method(aiMiddleware, "ddx", async () => ({ result: { data: { result: [] } } }));
  t.mock.method(console, "log", () => {});

  await computeForVisit("visit-1");
  assert.equal(typeof ddx.mock.calls[0].arguments[0].casehistory, "string");
});

test("both flags on with malformed JSON warns once and sends the string", async (t) => {
  withFlags(t, allOn);
  setup(t, { visit: [...visitRows, jsonRow("{bad")] });
  const ddx = t.mock.method(aiMiddleware, "ddx", async () => ({ result: { data: { result: [] } } }));
  t.mock.method(console, "log", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  await computeForVisit("visit-1");
  assert.equal(typeof ddx.mock.calls[0].arguments[0].casehistory, "string");
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /visit-1/);
});

test("a failure with a JSON payload records the request payload as a string", async (t) => {
  withFlags(t, allOn);
  t.mock.method(aiMiddleware, "ddx", async () => { throw new Error("boom"); });
  t.mock.method(console, "log", () => {});
  const { params } = await failOnce(t, { visit: [...visitRows, jsonRow(JSON.stringify(summaryObj))] });

  assert.equal(typeof params.request_payload, "string");
  assert.equal(params.request_payload, JSON.stringify(summaryObj));
});
