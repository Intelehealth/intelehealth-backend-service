require("dotenv").config();

const { authenticate, close } = require("./database");
const { createCronRunner } = require("./crons");
const { createHttpServer, listen } = require("./http-server");

const start = async () => {
  await authenticate();
  const runner = createCronRunner();
  const server = createHttpServer({ runner, database: { authenticate } });
  const port = await listen(server);
  const count = runner.start();
  console.info(`[cron-microservice] listening on ${port}; ${count} cron job(s) active`);

  const shutdown = async () => {
    runner.stop();
    await new Promise((resolve) => server.close(resolve));
    await close();
  };

  process.once("SIGINT", () => shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => shutdown().finally(() => process.exit(0)));
};

start().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
