"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const basename = path.basename(__filename);
const db = {};
const {
  MYSQL_OPENMRS_DB,
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
  database: MYSQL_OPENMRS_DB || "openmrs",
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

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js"
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
