const mysql = require("mysql");
let db;

connectDatabase = () => {
  if (!db) {
    const { MYSQL_DB, MYSQL_USERNAME, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT } = process.env;

    db = mysql.createConnection({
      dialect: "mysql",
      host: MYSQL_HOST || "localhost",
      port: MYSQL_PORT || 3306,
      user: MYSQL_USERNAME || "root",
      password: MYSQL_PASS,
      database: MYSQL_DB || "mindmap_server",
    });

    db.connect((err) => {
      if (!err) {
        console.log("Database is connected!");
      } else {
        console.log("Error connecting database!");
      }
    });
  }
  return db;
};

module.exports = connectDatabase();