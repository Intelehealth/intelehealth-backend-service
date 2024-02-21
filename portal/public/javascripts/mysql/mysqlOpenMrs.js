var mysql = require("mysql");
// var config = require("../../../config/config.json");
var db;

connectDatabase = () => {
  if (!db) {
    // const env = process.env.NODE_ENV ? process.env.NODE_ENV : "production";
    // const settings = {
    //   ...config[env],
    //   user: config[env].username,
    //   database: "openmrs",
    // };
    // db = mysql.createConnection(settings);
    const { MYSQL_OPENMRS_DB, MYSQL_USERNAME, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT } =
    process.env;

    db = mysql.createConnection({
      host: MYSQL_HOST || "localhost",
      port: MYSQL_PORT || 3306,
      user: MYSQL_USERNAME || "root",
      password: MYSQL_PASS,
      database: MYSQL_OPENMRS_DB || "openmrs",
    });

    db.connect((err) => {
      if (!err) {
        console.log("Database is connected - OpenMrs");
      } else {
        console.log("Error connecting database - OpenMrs");
      }
    });
  }
  return db;
};

module.exports = connectDatabase();
