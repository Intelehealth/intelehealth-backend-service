const { withAdvisoryLock } = require('../../database/advisory-lock');
const { syncAwaitingVisits } = require('../../database/visit-queue.repository');
const { isFeatureEnabled } = require('../services/ai-llm-feature.service');

const VISIT_QUEUE_SYNC_LOCK = 'cron_microservice_visit_queue_sync';
const AI_DDX_PRECOMPUTE_KEY = 'ai_ddx_precompute';

const runVisitQueueSync = async ({ dependencies = {} } = {}) => {
  const checkEnabled = dependencies.isFeatureEnabled || isFeatureEnabled;
  if (!(await checkEnabled(AI_DDX_PRECOMPUTE_KEY))) {
    return { skipped: true, reason: 'disabled' };
  }

  const withLock = dependencies.withLock || ((run) => withAdvisoryLock(VISIT_QUEUE_SYNC_LOCK, run));
  const sync = dependencies.syncAwaitingVisits || syncAwaitingVisits;
  return withLock(() => sync());
};

module.exports = { runVisitQueueSync, VISIT_QUEUE_SYNC_LOCK, AI_DDX_PRECOMPUTE_KEY };
