require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

module.exports = {
  [env]: {
    username: process.env.MYSQL_USERNAME || 'root',
    password: process.env.MYSQL_PASS || null,
    database: process.env.MYSQL_DB || 'mindmap_server',
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    dialect: process.env.MYSQL_DIALECT || 'mysql',
    logging: false
  }
};
