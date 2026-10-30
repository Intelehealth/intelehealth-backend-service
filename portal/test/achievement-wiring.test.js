"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { stubModule, forget } = require("./helpers/stub");
const { DataTypes, Sequelize, Model } = require("sequelize");

test("user_activity model: one row per provider per day, no timestamps", () => {
  const sequelize = new Sequelize({ dialect: "mysql", logging: false });
  const defineModel = require("../models/user_activity");
  const model = defineModel(sequelize, DataTypes);

  assert.ok(model.prototype instanceof Model);
  assert.equal(model.tableName, "user_activity");
  assert.deepEqual(model.primaryKeyAttributes, ["provider_uuid", "activity_date"]);
  assert.deepEqual(Object.keys(model.rawAttributes).sort(), [
    "active_seconds",
    "activity_date",
    "covered_until",
    "last_request_crc",
    "provider_uuid",
  ]);
  assert.equal(model.rawAttributes.active_seconds.defaultValue, 0);
  assert.equal(model.rawAttributes.last_request_crc.allowNull, true);
  assert.equal(model.rawAttributes.covered_until.allowNull, false);
  assert.equal(model.options.timestamps, false);
  assert.equal(model.associate({}), undefined);
});

test("migration: creates and drops the user_activity table", async () => {
  const migration = require("../migrations/20261027120000-create-user-activity");
  const calls = [];
  const queryInterface = {
    createTable: async (name, columns) => calls.push(["create", name, columns]),
    dropTable: async (name) => calls.push(["drop", name]),
  };

  await migration.up(queryInterface, Sequelize);
  const [, name, columns] = calls[0];
  assert.equal(name, "user_activity");
  assert.deepEqual(Object.keys(columns), [
    "provider_uuid",
    "activity_date",
    "active_seconds",
    "covered_until",
    "last_request_crc",
  ]);
  assert.equal(columns.provider_uuid.primaryKey, true);
  assert.equal(columns.activity_date.primaryKey, true);
  assert.equal(columns.active_seconds.defaultValue, 0);
  assert.equal(columns.last_request_crc.allowNull, true);

  await migration.down(queryInterface, Sequelize);
  assert.deepEqual(calls[1], ["drop", "user_activity"]);
});

test("activity route: POST /heartbeat is behind the auth middleware", () => {
  const authMiddleware = () => {};
  const recordHeartbeat = () => {};
  const restoreAuth = stubModule("middleware/auth", authMiddleware);
  const restoreController = stubModule("controllers/achievement.controller", { recordHeartbeat });
  forget("routes/activity.route");
  try {
    const router = require("../routes/activity.route");
    const layer = router.stack.find((l) => l.route && l.route.path === "/heartbeat");
    assert.ok(layer, "route is registered");
    assert.deepEqual(Object.keys(layer.route.methods), ["post"]);
    assert.deepEqual(
      layer.route.stack.map((s) => s.handle),
      [authMiddleware, recordHeartbeat]
    );
  } finally {
    restoreAuth();
    restoreController();
    forget("routes/activity.route");
  }
});
