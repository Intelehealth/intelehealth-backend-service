var mysql = require("mysql");
var config = require("../../../config/config.json");
var db;

connectDatabase = () => {
  if (!db) {
    const env = process.env.NODE_ENV ? process.env.NODE_ENV : "production";
    const settings = { ...config[env], user: config[env].username };
    db = mysql.createConnection(settings);

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
