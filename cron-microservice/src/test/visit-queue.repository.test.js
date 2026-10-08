const test = require("node:test");
const assert = require("node:assert/strict");
const { database } = require("../database");
const { claimNext } = require("../database/visit-queue.repository");

test("claimNext uses plain FOR UPDATE so it runs on MySQL 5.7 and MariaDB before 10.6", async (t) => {
  const statements = [];
  const connection = {
    beginTransaction: async () => {},
    query: async (sql) => { statements.push(sql); return [[{ id: 1, visit_uuid: "v1" }]]; },
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
  t.mock.method(database, "query", async () => [{ affectedRows: 0 }]);
  t.mock.method(database, "getConnection", async () => connection);

  const rows = await claimNext(3);

  assert.deepEqual(rows, [{ id: 1, visit_uuid: "v1" }]);
  const select = statements.find((sql) => sql.includes("SELECT * FROM visit_queue"));
  assert.match(select, /FOR UPDATE/);
  assert.doesNotMatch(select, /SKIP LOCKED|NOWAIT/);
});
