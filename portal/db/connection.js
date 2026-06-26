const { Sequelize } = require('sequelize');

const cache = {};

function getDbUrlForTenant(tenant) {
  if (tenant === 'nezazi') {
    return process.env.DB_URL_NEZAZI || process.env.MYSQL_URL_NEZAZI || null;
  }
  return process.env.DB_URL_EZAZI || process.env.MYSQL_URL || null;
}

function getConnection(tenant) {
  const url = getDbUrlForTenant(tenant);
  if (!url) throw new Error(`DB URL not configured for tenant '${tenant}'`);
  if (cache[tenant]) return cache[tenant];

  const sequelize = new Sequelize(url, {
    dialect: process.env.MYSQL_DIALECT || 'mysql',
    logging: false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    },
  });

  cache[tenant] = sequelize;
  return sequelize;
}

module.exports = { getConnection };
