const test = require("node:test");
const assert = require("node:assert/strict");
const { parseBoolean, parseJsonArray, numberFromEnv } = require("../config");

test("parses service configuration", () => {
  assert.equal(parseBoolean("ON"), true);
  assert.equal(parseBoolean("false", true), false);
  assert.deepEqual(parseJsonArray('[{"name":"metric"}]', []), [{ name: "metric" }]);
  assert.equal(numberFromEnv("3010", 3000), 3010);
  assert.throws(() => numberFromEnv("invalid", 3010), /Invalid numeric configuration/);
});
