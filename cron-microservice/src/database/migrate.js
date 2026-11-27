require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { database } = require("./index");

const migrate = async () => {
  const connection = await database.getConnection();
  let lockAcquired = false;
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(190) NOT NULL PRIMARY KEY,
      executed_at DATETIME NOT NULL
    ) ENGINE=InnoDB`);
    const [[lock]] = await connection.query("SELECT GET_LOCK('cron_microservice_migrations', 30) AS acquired");
    lockAcquired = Number(lock.acquired) === 1;
    if (!lockAcquired) throw new Error("Could not acquire the migration lock");
    const [completed] = await connection.query("SELECT id FROM schema_migrations");
    const completedIds = new Set(completed.map(({ id }) => id));
    const directory = path.join(__dirname, "migrations");
    const files = fs.readdirSync(directory).filter((file) => file.endsWith(".js")).sort();

    for (const file of files) {
      const migration = require(path.join(directory, file));
      if (completedIds.has(migration.id)) continue;
      await migration.up(connection);
      await connection.query(
        "INSERT INTO schema_migrations (id, executed_at) VALUES (:id, :executedAt)",
        { id: migration.id, executedAt: new Date() }
      );
      console.info(`[migration] ${migration.id}`);
    }
  } finally {
    if (lockAcquired) await connection.query("SELECT RELEASE_LOCK('cron_microservice_migrations')");
    connection.release();
  }
};

if (require.main === module) {
  migrate()
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    })
    .finally(() => database.end());
}

module.exports = { migrate };
