"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const config = require("../config/env");

const basename = path.basename(__filename);
const db = {};

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  dialect: "mysql",
  host: config.db.host,
  port: config.db.port,
  logging: config.db.logging ? console.log : false,
  define: {
    // Doc-facing column names are snake_case (LLD §02); JS attributes stay
    // camelCase. freezeTableName keeps the table names exactly as documented.
    underscored: true,
    freezeTableName: true,
  },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});

fs.readdirSync(__dirname)
  .filter((file) => file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js")
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) db[modelName].associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
