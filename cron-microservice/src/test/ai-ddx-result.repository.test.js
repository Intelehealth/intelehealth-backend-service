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
