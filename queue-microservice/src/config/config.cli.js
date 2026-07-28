require('dotenv').config();

// Same DB env vars the app uses (see .env.example) so migrations and the
// running service always point at the same database.
const connection = {
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME || 'qms',
};

module.exports = {
  development: connection,
  test: connection,
  production: connection,
};
