const mysql = require("mysql2/promise");

const createPool = ({ host, port, user, password, name }) => mysql.createPool({
  host,
  port,
  user,
  password,
  database: name,
  namedPlaceholders: true,
  connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
  waitForConnections: true,
});

const database = createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USERNAME || "root",
  password: process.env.MYSQL_PASS,
  name: process.env.MYSQL_DB || "mindmap_server",
});

const openMrsDatabase = createPool({
  host: process.env.OPENMRS_MYSQL_HOST || process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.OPENMRS_MYSQL_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.OPENMRS_MYSQL_USERNAME || process.env.MYSQL_USERNAME || "root",
  password: process.env.OPENMRS_MYSQL_PASS || process.env.MYSQL_PASS,
  name: process.env.MYSQL_OPENMRS_DB || "openmrs",
});

const authenticatePool = async (pool) => {
  const connection = await pool.getConnection();
  connection.release();
};

const authenticate = () => Promise.all([authenticatePool(database), authenticatePool(openMrsDatabase)]);
const close = () => Promise.all([database.end(), openMrsDatabase.end()]);

module.exports = { database, openMrsDatabase, authenticate, close };
