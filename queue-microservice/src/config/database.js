require("dotenv").config();

/**
 * sequelize-cli configuration. Kept in sync with src/config/env.js — the CLI
 * needs a plain object at a fixed path, the app reads the same env vars.
 */
const base = {
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME || "mindmap_server",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  dialect: "mysql",
  logging: false,
  // QMS defaults to the same database portal uses (DB_NAME=mindmap_server),
  // which already has its own `SequelizeMeta`. Keep the two migration
  // histories apart so `sequelize db:migrate` in either service can never see
  // — or try to roll back — the other's migrations.
  migrationStorageTableName: "SequelizeMetaQms",
  seederStorage: "sequelize",
  seederStorageTableName: "SequelizeDataQms",
  define: {
    underscored: true,
    freezeTableName: true,
  },
};

module.exports = {
  development: base,
  test: base,
  production: base,
};