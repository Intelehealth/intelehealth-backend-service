"use strict";
const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: false,
    // READ COMMITTED reduces gap-locking on the queue table -> better concurrency
    // for the FOR UPDATE SKIP LOCKED claim query.
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    pool: { max: 10, min: 0, idle: 10000 },
  }
);

const db = {};
db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.QueueEntry = require("./queue_entry")(sequelize, DataTypes);

module.exports = db;
