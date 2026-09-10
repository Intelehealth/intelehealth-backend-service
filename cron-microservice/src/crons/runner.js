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

    const state = { running: false, lastStartedAt: null, lastCompletedAt: null, lastError: null, lastResult: null };
    const execute = async (options) => {
      if (state.running) {
        this.logger.warn(`[cron:${name}] previous execution is still running`);
        return;
      }

      state.running = true;
      state.lastStartedAt = new Date();
      state.lastError = null;
      try {
        state.lastResult = await task(options);
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
    this.tasks.set(name, { scheduledTask, state, schedule, timezone, execute });
  }

  /*
    A manual trigger reuses the same guarded execute() the schedule fires, so a
    test run can never overlap a scheduled one and shares the same running/error
    bookkeeping. It rethrows the failure instead of swallowing it, since an HTTP
    caller needs to know the run failed rather than reading state.lastError later.
  */
  async runNow(name, options) {
    const entry = this.tasks.get(name);
    if (!entry) throw new Error(`Unknown cron: ${name}`);
    if (entry.state.running) return { alreadyRunning: true };
    await entry.execute(options);
    if (entry.state.lastError) throw new Error(entry.state.lastError);
    return entry.state.lastResult;
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
      running: task.state.running,
      lastStartedAt: task.state.lastStartedAt,
      lastCompletedAt: task.state.lastCompletedAt,
      lastError: task.state.lastError,
    }));
  }
}

module.exports = { CronRunner };
