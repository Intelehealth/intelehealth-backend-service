"use strict";

const Sequelize = require("sequelize");
const db = {};

const {
  MYSQL_USERNAME,
  MYSQL_PASS,
  MYSQL_DIALECT,
  MYSQL_HOST,
  MYSQL_PORT,
} = process.env;

const sequelize = new Sequelize({
  dialect: MYSQL_DIALECT || "mysql",
  host: MYSQL_HOST || "localhost",
  port: MYSQL_PORT || 3306,
  username: MYSQL_USERNAME || "root",
  password: MYSQL_PASS,
  database: "openmrs",
  define: {
    timestamps: false,
    freezeTableName: true,
  },
  pool: {
    max: 5,
    min: 0,
    idle: 5000,
  },
  logging: false,
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
