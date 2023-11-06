var mysql = require("mysql");
var config = process.env
var db;

connectDatabase = () => {
  if (!db) {
    
    const settings = {
      user: process.env.DB_USERNAME,
      database: "openmrs",
      password: process.env.DB_PASSWORD,
    };
    
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
