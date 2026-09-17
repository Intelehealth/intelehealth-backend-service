const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const queueRoute = require("../src/routes/queue.route");
const { validateBody } = require("../src/middleware/validate");
const models = require("../src/models");

/**
 * patient_uuid — re-added after the slimming migration dropped it as "never
 * read back". It now has to travel through submit, and show up in every
 * queue data response (status, /list, the doctor panel).
 *
 * Unlike locationUuid it stays nullable in the DB: pre-existing rows predate
 * the column and there is no safe backfill value for a patient identifier.
 * "Required" here is an API-level rule for new submits, not a DB constraint.
 */

const submitSchema = queueRoute.schemas.submit;

const validate = (body) => {
  const req = { body };
  let error = null;
  validateBody(submitSchema)(req, null, (err) => {
    error = err || null;
  });
  return { error, validated: req.validated };
};

const goodBody = {
  visitUuid: "visit-1",
  patientUuid: "patient-1",
  hwUserUuid: "hw-1",
  locationUuid: "loc-pune-01",
  speciality: "Dermatology",
};

test("patientUuid is declared required on submit", () => {
  assert.equal(submitSchema.patientUuid.required, true);
  assert.equal(submitSchema.patientUuid.type, "string");
  assert.equal(submitSchema.patientUuid.maxLength, 64);
});

test("a submit without patientUuid is refused, and says which field", () => {
  const { patientUuid, ...withoutPatient } = goodBody;
  const { error } = validate(withoutPatient);
  assert.ok(error, "a body with no patientUuid must not validate");
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.ok(
    error.details.errors.some((e) => e.includes("patientUuid")),
    `the error must name the field: ${JSON.stringify(error.details.errors)}`
  );
});

test("a valid submit body (with patientUuid) passes through untouched", () => {
  const { error, validated } = validate(goodBody);
  assert.equal(error, null);
  assert.equal(validated.patientUuid, "patient-1");
});

test("the model declares patientUuid, and it stays nullable (no backfill value exists)", () => {
  const attr = models.queue_entries.rawAttributes.patientUuid;
  assert.ok(attr, "the model must declare patientUuid");
  assert.equal(attr.field, "patient_uuid");
  assert.equal(attr.allowNull, true);
});

test("/list can filter by patientUuid, like it does by visitUuid", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/queue.service.js"),
    "utf8"
  );
  assert.ok(
    source.includes("if (filters.patientUuid) where.patientUuid = filters.patientUuid;"),
    "listQueue must apply a patientUuid filter"
  );
});

test("patientUuid is returned by every queue data shape: status, /list, and the doctor panel", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/queue.service.js"),
    "utf8"
  );
  // statusPayload, toListItem, and the listForDoctor cases mapper each build
  // their own object literal — a shared serializer would make this one check,
  // but until then each has to be pinned separately so one of the three
  // cannot quietly drop the field again.
  const matches = source.match(/patientUuid: entry\.patientUuid/g) || [];
  assert.equal(
    matches.length,
    3,
    "expected patientUuid in statusPayload, toListItem and listForDoctor's cases mapper"
  );
});
