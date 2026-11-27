const test = require('node:test');
const assert = require('node:assert');

const loadService = (published) => {
  process.env.AI_LLM_CONFIG_SERVICE_URL = 'http://config.local/api';
  global.fetch = async () => ({ ok: true, json: async () => published });
  delete require.cache[require.resolve('../crons/services/ai-llm-feature.service')];
  return require('../crons/services/ai-llm-feature.service');
};

test('flag missing from published config is treated as disabled', async () => {
  const { isFeatureEnabled } = loadService({ ai_llm: { differential_diagnosis: true } });
  assert.strictEqual(await isFeatureEnabled('ai_ddx_precompute'), false);
});

test('flag explicitly true is enabled', async () => {
  const { isFeatureEnabled } = loadService({ ai_llm: { ai_ddx_precompute: true } });
  assert.strictEqual(await isFeatureEnabled('ai_ddx_precompute'), true);
});

test('flag explicitly false is disabled', async () => {
  const { isFeatureEnabled } = loadService({ ai_llm: { ai_ddx_precompute: false } });
  assert.strictEqual(await isFeatureEnabled('ai_ddx_precompute'), false);
});

test('config service unreachable is treated as disabled', async () => {
  process.env.AI_LLM_CONFIG_SERVICE_URL = 'http://config.local/api';
  global.fetch = async () => { throw new Error('down'); };
  delete require.cache[require.resolve('../crons/services/ai-llm-feature.service')];
  const { isFeatureEnabled } = require('../crons/services/ai-llm-feature.service');
  assert.strictEqual(await isFeatureEnabled('ai_ddx_precompute'), false);
});
