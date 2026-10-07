const { withAdvisoryLock } = require('../../database/advisory-lock');
const { claimNext, markDone, markFailed } = require('../../database/visit-queue.repository');
const { computeForVisit, recordFailure } = require('../../database/ai-ddx-result.repository');
const { isFeatureEnabled } = require('../services/ai-llm-feature.service');

const DDX_WORKER_LOCK = 'cron_microservice_ddx_worker';
const AI_DDX_PRECOMPUTE_KEY = 'ai_ddx_precompute';

const processQueue = async (limit, dependencies = {}) => {
  const claim = dependencies.claimNext || claimNext;
  const compute = dependencies.computeForVisit || computeForVisit;
  const recordFail = dependencies.recordFailure || recordFailure;
  const markRowDone = dependencies.markDone || markDone;
  const markRowFailed = dependencies.markFailed || markFailed;
  const timeout = Number(process.env.AI_VISIT_CRON_REQUEST_TIMEOUT) || 60000;
  const parallelRequests = Number(process.env.AI_VISIT_CRON_PARALLEL_REQUEST_TO_CALL_DDX) || 1;

  const rows = await claim(limit);
  if (!rows.length) {
    return { picked: 0, done: 0, failed: 0 };
  }

  let done = 0;
  let failed = 0;

  const processOne = async (row) => {
    try {
      await compute(row.visit_uuid, { timeout });
      await markRowDone(row.id);
      done += 1;
    } catch (error) {
      await recordFail(row.visit_uuid, error);
      await markRowFailed(row.id, row.attempts);
      failed += 1;
    }
  };

  let nextIndex = 0;
  const poolSize = Math.max(1, Math.min(parallelRequests, rows.length));
  const workers = Array.from({ length: poolSize }, async () => {
    while (nextIndex < rows.length) {
      const row = rows[nextIndex];
      nextIndex += 1;
      await processOne(row);
    }
  });
  await Promise.all(workers);

  return { picked: rows.length, done, failed };
};

const runDdxWorker = async ({ dependencies = {} } = {}) => {
  const checkEnabled = dependencies.isFeatureEnabled || isFeatureEnabled;
  if (!(await checkEnabled(AI_DDX_PRECOMPUTE_KEY))) {
    return { skipped: true, reason: 'disabled' };
  }

  const withLock = dependencies.withLock || ((run) => withAdvisoryLock(DDX_WORKER_LOCK, run));
  const limit = Number(process.env.AI_VISIT_CRON_PARALLEL_REQUEST_TO_CALL_DDX) || 8;
  return withLock(() => processQueue(limit, dependencies));
};

module.exports = { runDdxWorker, processQueue, DDX_WORKER_LOCK, AI_DDX_PRECOMPUTE_KEY };
