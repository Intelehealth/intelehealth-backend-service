var mysql = require("mysql");
var db;

connectDatabase = () => {
  if (!db) {
    const settings = {
      host: process.env.MYSQL_HOST, 
      user: process.env.MYSQL_USERNAME,
      password: process.env.MYSQL_PASS,
      port: process.env.MYSQL_PORT,
      database: process.env.MYSQL_OPENMRS_DB
    };
    db = mysql.createConnection(settings);

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
