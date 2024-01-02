const mysql = require("mysql");
let db;

/**
 * Connect to openmrs database
 * @returns - database instance
 */
connectDatabase = () => {
  if (!db) {
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
