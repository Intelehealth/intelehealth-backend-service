// Connectivity check for tenant databases.
//
// Default (uses .env DB_URL_EZAZI / DB_URL_NEZAZI):
//   node scripts/test-tenant-db.js
//
// Test a single tenant:
//   node scripts/test-tenant-db.js nezazi
//
// Override the URL (e.g. when run on the server or through an SSH tunnel):
//   node scripts/test-tenant-db.js nezazi mysql://user:pass@127.0.0.1:13307/openmrsne
require('dotenv').config();
const { Sequelize } = require('sequelize');

function mask(url) {
  try { return url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'); } catch { return url; }
}

async function check(tenant, overrideUrl) {
  const start = Date.now();
  try {
    // Use override URL if given, else the tenant URL from .env (no repo deps needed).
    const url = overrideUrl
      || (tenant === 'nezazi'
        ? (process.env.DB_URL_NEZAZI || process.env.MYSQL_URL_NEZAZI)
        : (process.env.DB_URL_EZAZI || process.env.MYSQL_URL));
    if (!url) throw new Error(`no DB URL configured for tenant '${tenant}'`);
    const sequelize = new Sequelize(url, { dialect: process.env.MYSQL_DIALECT || 'mysql', logging: false });
    await sequelize.authenticate();
    const [rows] = await sequelize.query('SELECT DATABASE() AS db, VERSION() AS version');
    const ms = Date.now() - start;
    console.log(`✅ ${tenant.padEnd(7)} OK  (${ms}ms)  db=${rows[0].db}  mysql=${rows[0].version}`);
    return true;
  } catch (err) {
    console.log(`❌ ${tenant.padEnd(7)} FAIL  ${err.message}`);
    return false;
  }
}

(async () => {
  const [tenantArg, urlArg] = process.argv.slice(2);
  const tenants = tenantArg ? [tenantArg] : ['ezazi', 'nezazi'];
  if (urlArg) console.log(`(using override URL ${mask(urlArg)} for ${tenantArg})`);
  const results = await Promise.all(tenants.map((t) => check(t, t === tenantArg ? urlArg : undefined)));
  process.exit(results.every(Boolean) ? 0 : 1);
})();
