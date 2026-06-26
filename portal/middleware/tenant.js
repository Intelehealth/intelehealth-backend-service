const { getConnection } = require('../db/connection');
const initModels = require('../models/init-models');
const { als, runWithContext } = require('../db/context');

module.exports = function tenantMiddleware(req, res, next) {
  try {
    const host = (req.hostname || req.get('host') || '').toLowerCase();
    let tenant = 'ezazi';
    if (host.includes('nezazi')) tenant = 'nezazi';

    const sequelize = getConnection(tenant);

    const cacheKey = `${tenant}Models`;
    if (!req.app.locals[cacheKey]) {
      req.app.locals[cacheKey] = initModels(sequelize);
    }

    const models = req.app.locals[cacheKey];

    // run the rest of request in an async context with models/sequelize attached
    runWithContext({ models, sequelize, tenant }, () => next());
  } catch (err) {
    next(err);
  }
};
