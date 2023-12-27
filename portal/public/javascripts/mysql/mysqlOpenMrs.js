const mysql = require("mysql");
const config = require("../../../config/config.json");
let pool;

connectDatabase = () => {
  if (!pool) {
    const env = process.env.NODE_ENV ? process.env.NODE_ENV : "production";
    const settings = {
      ...config[env],
      user: config[env].username,
      database: "openmrs",
    };
    pool = mysql.createPool(settings);
    pool.getConnection((err) => {
      if (!err) {
        console.log("Database is connected - OpenMrs-");
      } else {
        console.log("Error connecting database - OpenMrs");
      }
    });

    // db.connect((err) => {
    //   if (!err) {
    //     console.log("Database is connected - OpenMrs-");
    //   } else {
    //     console.log("Error connecting database - OpenMrs");
    //   }
    // });
  }
  return pool;
};

module.exports = connectDatabase();
