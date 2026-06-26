const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

function runWithContext(ctx, fn) {
  return als.run(ctx, fn);
}

function getStore() {
  return als.getStore();
}

function getModels() {
  const store = als.getStore();
  return store ? store.models : null;
}

function getSequelize() {
  const store = als.getStore();
  return store ? store.sequelize : null;
}

module.exports = { als, runWithContext, getStore, getModels, getSequelize };
