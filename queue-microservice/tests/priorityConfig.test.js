const test = require("node:test");
const assert = require("node:assert/strict");

const priorityConfig = require("../src/services/priorityConfig.service");

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * Priority Engine Algorithm Spec §07.
 *
 * "Loader rejects the config outright if Σweights ≠ 1.0 (within float
 * tolerance) — fail closed at startup, not silently miscalibrated in
 * production."
 */

test("the documented defaults are valid", () => {
  assert.doesNotThrow(() => priorityConfig.validate(clone(priorityConfig.defaults)));
});

test("weights that do not sum to 1.0 are rejected", () => {
  const config = clone(priorityConfig.defaults);
  config.weights.wait = 0.5; // total 1.3

  assert.throws(
    () => priorityConfig.validate(config),
    (err) => {
      assert.equal(err.code, "INVALID_PRIORITY_CONFIG");
      assert.ok(err.details.problems.some((p) => /sum to 1\.0/.test(p)));
      return true;
    }
  );
});

test("float tolerance still accepts weights that only round to 1.0", () => {
  const config = clone(priorityConfig.defaults);
  config.weights = { emergency: 0.4, caseType: 0.3, wait: 0.2, spec: 0.1 };
  // 0.4 + 0.3 + 0.2 + 0.1 is 0.9999999999999999 in IEEE-754.
  assert.notEqual(Object.values(config.weights).reduce((a, b) => a + b, 0), 1);
  assert.doesNotThrow(() => priorityConfig.validate(config));
});

test("negative weights are rejected even if the total still reaches 1.0", () => {
  const config = clone(priorityConfig.defaults);
  config.weights = { emergency: 0.9, caseType: 0.3, wait: -0.1, spec: -0.1 };
  assert.throws(() => priorityConfig.validate(config));
});

test("the aging curve must stay monotonic by construction", () => {
  const descending = clone(priorityConfig.defaults);
  descending.agingRatesPerMin = [
    { upToMin: 30, rate: 2 },
    { upToMin: 15, rate: 5 }, // boundary goes backwards
    { upToMin: null, rate: 20 },
  ];
  assert.throws(() => priorityConfig.validate(descending), /rejected/);

  const negative = clone(priorityConfig.defaults);
  negative.agingRatesPerMin = [
    { upToMin: 15, rate: -2 },
    { upToMin: null, rate: 20 },
  ];
  assert.throws(() => priorityConfig.validate(negative), /rejected/);
});

test("the last aging tier must be open-ended so W grows without bound", () => {
  // §04 depends on this: "W(m) grows without bound past 45 minutes by design —
  // no fixed constant is guaranteed to outrank every possible aged score."
  const config = clone(priorityConfig.defaults);
  config.agingRatesPerMin = [
    { upToMin: 15, rate: 2 },
    { upToMin: 45, rate: 20 },
  ];
  assert.throws(
    () => priorityConfig.validate(config),
    (err) => err.details.problems.some((p) => /open-ended/.test(p))
  );
});

test("every SLA cap in the §05.3 table is required", () => {
  const config = clone(priorityConfig.defaults);
  delete config.slaCapsMin.FOLLOW_UP;
  assert.throws(
    () => priorityConfig.validate(config),
    (err) => err.details.problems.some((p) => /slaCapsMin.FOLLOW_UP is required/.test(p))
  );
});

test("doctor assignment weights must also sum to 1.0", () => {
  const config = clone(priorityConfig.defaults);
  config.doctorAssignment.weights.rating = 0.5;
  assert.throws(
    () => priorityConfig.validate(config),
    (err) => err.details.problems.some((p) => /doctorAssignment\.weights/.test(p))
  );
});
