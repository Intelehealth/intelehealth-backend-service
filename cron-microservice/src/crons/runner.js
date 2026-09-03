const cron = require("node-cron");

class CronRunner {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.tasks = new Map();
  }

  register({ name, schedule, task, enabled = true, timezone }) {
    if (!enabled) return;
    if (!name || typeof task !== "function") throw new Error("Cron name and task are required");
    if (this.tasks.has(name)) throw new Error(`Cron already registered: ${name}`);
    if (!cron.validate(schedule)) throw new Error(`Invalid schedule for ${name}: ${schedule}`);

    const state = { running: false, lastStartedAt: null, lastCompletedAt: null, lastError: null };
    const execute = async () => {
      if (state.running) {
        this.logger.warn(`[cron:${name}] previous execution is still running`);
        return;
      }

      state.running = true;
      state.lastStartedAt = new Date();
      state.lastError = null;
      try {
        await task();
        state.lastCompletedAt = new Date();
        this.logger.info(`[cron:${name}] completed`);
      } catch (error) {
        state.lastError = error.message;
        this.logger.error(`[cron:${name}] ${error.stack || error.message}`);
      } finally {
        state.running = false;
      }
    };

    const scheduledTask = cron.createTask(schedule, execute, { timezone });
    this.tasks.set(name, { scheduledTask, state, schedule, timezone });
  }

  start() {
    for (const { scheduledTask } of this.tasks.values()) scheduledTask.start();
    return this.tasks.size;
  }

  stop() {
    for (const { scheduledTask } of this.tasks.values()) scheduledTask.stop();
  }

  status() {
    return [...this.tasks.entries()].map(([name, task]) => ({
      name,
      schedule: task.schedule,
      timezone: task.timezone,
      ...task.state,
    }));
  }
}

module.exports = { CronRunner };
