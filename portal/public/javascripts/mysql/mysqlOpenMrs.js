const mysql = require("mysql");

connectDatabase = () => {
  let db;
  if (!db) {
    const { MYSQL_USERNAME, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT } = process.env;

    db = mysql.createConnection({
      host: MYSQL_HOST || "localhost",
      port: MYSQL_PORT || 3306,
      user: MYSQL_USERNAME || "root",
      password: MYSQL_PASS,
      database: "openmrs",
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
