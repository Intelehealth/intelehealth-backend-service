const fs = require('fs');
const path = require('path');

module.exports = function initModels(sequelize) {
  const models = {};
  const dir = __dirname;

  fs.readdirSync(dir)
    .filter((f) => f !== 'init-models.js' && f.endsWith('.js'))
    .forEach((file) => {
      const factory = require(path.join(dir, file));
      if (typeof factory === 'function') {
        const model = factory(sequelize, sequelize.constructor.DataTypes);
        models[model.name] = model;
      }
    });

  Object.values(models).forEach((m) => {
    if (typeof m.associate === 'function') m.associate(models);
  });

  return models;
};
