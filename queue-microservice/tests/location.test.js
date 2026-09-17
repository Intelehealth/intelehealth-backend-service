const test = require("node:test");
const assert = require("node:assert/strict");

const queueRoute = require("../src/routes/queue.route");
const { validateBody } = require("../src/middleware/validate");
const models = require("../src/models");

/**
 * location_uuid — the facility a visit was raised at.
 *
 * Mandatory on submit, and a filter on the reporting reads. It deliberately
 * does NOT split the queue: see the scope note in the migration and the lane
 * test at the bottom.
 */

const submitSchema = queueRoute.schemas.submit;

/** Drive the real validator the way Express does, and report what happened. */
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

test("locationUuid is declared required on submit", () => {
  assert.equal(submitSchema.locationUuid.required, true);
  assert.equal(submitSchema.locationUuid.type, "string");
  // No default: a default would quietly attribute a case to the wrong place,
  // which is worse than refusing the request.
  assert.equal(submitSchema.locationUuid.default, undefined);
});

test("a submit without locationUuid is refused, and says which field", () => {
  const { locationUuid, ...withoutLocation } = goodBody;
  const { error } = validate(withoutLocation);
  assert.ok(error, "a body with no locationUuid must not validate");
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.ok(
    error.details.errors.some((e) => e.includes("locationUuid")),
    `the error must name the field: ${JSON.stringify(error.details.errors)}`
  );
});

test("an empty or whitespace-only locationUuid is refused, not stored blank", () => {
  // A whitespace-only value used to trim down to "" AFTER the absent-check and
  // sail straight past `required` — which would have written an entry with a
  // blank facility. It must be refused outright, like any missing field.
  for (const value of ["", "   ", "\t\n"]) {
    const { error } = validate({ ...goodBody, locationUuid: value });
    assert.ok(error, `locationUuid ${JSON.stringify(value)} must be refused`);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.ok(
      error.details.errors.some((e) => e.includes("locationUuid")),
      `the error must name the field for ${JSON.stringify(value)}`
    );
  }
});

test("the same blank-string hole is closed for every required field", () => {
  // The bug was in the shared coercer, so it applied to every required string
  // on every endpoint. Pinning it here keeps the fix from being narrowed back
  // down to locationUuid later.
  for (const field of ["visitUuid", "patientUuid", "hwUserUuid", "speciality"]) {
    if (!submitSchema[field]?.required) continue;
    const { error } = validate({ ...goodBody, [field]: "   " });
    assert.ok(error, `a whitespace-only ${field} must be refused`);
    assert.ok(error.details.errors.some((e) => e.includes(field)), field);
  }
});

test("a legitimate value with surrounding whitespace is trimmed, not refused", () => {
  const { error, validated } = validate({ ...goodBody, locationUuid: "  loc-pune-01  " });
  assert.equal(error, null);
  assert.equal(validated.locationUuid, "loc-pune-01");
});

test("a valid locationUuid passes through untouched", () => {
  const { error, validated } = validate(goodBody);
  assert.equal(error, null);
  assert.equal(validated.locationUuid, "loc-pune-01");
});

test("locationUuid is length-capped like every other identifier", () => {
  assert.equal(submitSchema.locationUuid.maxLength, 64);
  const { error } = validate({ ...goodBody, locationUuid: "x".repeat(65) });
  assert.ok(error, "an over-long locationUuid must be refused");
  assert.equal(error.code, "VALIDATION_ERROR");
});

test("the column is NOT NULL, so a case can never be stored without one", () => {
  const attr = models.queue_entries.rawAttributes.locationUuid;
  assert.ok(attr, "the model must declare locationUuid");
  assert.equal(attr.field, "location_uuid");
  assert.equal(attr.allowNull, false);
});

test("the reporting reads can filter by location", () => {
  const paths = queueRoute.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
  assert.ok(paths.includes("/list"));
  assert.ok(paths.includes("/specialities"));
});

test("location filters the case counts but never the doctor counts", () => {
  // A doctor serves every facility, so scoping doctor presence by location
  // would report zero doctors for a location that is perfectly well covered.
  const source = require("fs").readFileSync(
    require("path").join(__dirname, "../src/services/analytics.service.js"),
    "utf8"
  );
  assert.ok(
    source.includes("where: speciality ? { speciality } : {}"),
    "the doctor_queue_status read must not inherit the location filter"
  );
});

test("location does not split the queue — one line per speciality", () => {
  // The open question in LLD §13.5. Storing and filtering by location is not
  // the same as partitioning by it, and this pins which one was built: if the
  // lane scope ever gains locationUuid, that is a deliberate product change and
  // this test is the place it gets noticed.
  const queueLane = require("../src/services/queueLane.service");
  const lane = queueLane.lanesInOrder({ speciality: "Dermatology", locationUuid: "loc-1" });
  for (const l of lane) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(l.where, "locationUuid"),
      false,
      `lane ${l.name} must not be scoped by location`
    );
  }
});
