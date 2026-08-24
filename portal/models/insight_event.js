'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class insight_event extends Model {
    static associate(models) {
    }
  };
  insight_event.init({
    event_uuid: {
      type: DataTypes.STRING(36),
      unique: true
    },
    event_name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    source: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    actor_type: DataTypes.STRING(32),
    actor_id: DataTypes.STRING(64),
    entity_type: DataTypes.STRING(32),
    entity_id: DataTypes.STRING(64),
    properties: DataTypes.JSON,
    occurred_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'insight_event',
    timestamps: false
  });
  return insight_event;
};
