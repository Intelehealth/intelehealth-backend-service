const mysql = require("mysql");
let db;

/**
 * Connect to mindmap database
 * @returns - database instance
 */
const connectDatabase = () => {
  if (!db) {
    handleDisconnect();
  }
  return db;
};

const handleDisconnect = () => {
  const { MYSQL_DB, MYSQL_USERNAME, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT } =
      process.env;

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

    db.on('error', (err) => {
      console.log('database error', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        handleDisconnect();
      } else {
        throw err;
      }
    });
}

module.exports = connectDatabase();
