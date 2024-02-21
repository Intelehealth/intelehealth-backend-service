var mysql = require("mysql");
// var config = require("../../../config/config.json");
var db;

connectDatabase = () => {
  if (!db) {
    // const env = process.env.NODE_ENV ? process.env.NODE_ENV : "production";
    // const settings = { ...config[env], user: config[env].username };
    const { MYSQL_DB, MYSQL_USERNAME, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT } = process.env;
    // db = mysql.createConnection(settings);
    db = mysql.createConnection({
      dialect: "mysql",
      port: MYSQL_PORT || 3306,
      host: MYSQL_HOST || "localhost",
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
