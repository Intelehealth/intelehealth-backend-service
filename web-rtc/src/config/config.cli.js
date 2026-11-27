require('dotenv').config();

const connection = {
  dialect: process.env.MYSQL_DIALECT || 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  username: process.env.MYSQL_USERNAME || 'root',
  password: process.env.MYSQL_PASS || null,
  database: process.env.MYSQL_DB || 'mindmap_server',
};

module.exports = {
  development: connection,
  test: connection,
  production: connection,
};
