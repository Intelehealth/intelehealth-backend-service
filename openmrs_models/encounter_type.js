'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class encounter_type extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  encounter_type.init({
    encounter_type_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    description: DataTypes.TEXT,
    creator: DataTypes.INTEGER,
    date_created: DataTypes.DATE,
    retired: DataTypes.BOOLEAN,
    retired_by: DataTypes.INTEGER,
    date_retired: DataTypes.DATE,
    retire_reason: DataTypes.STRING,
    uuid: DataTypes.STRING,
    view_privilege: DataTypes.STRING,
    edit_privilege: DataTypes.STRING,
    changed_by: DataTypes.INTEGER,
    date_changed: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'encounter_type',
  });
  return encounter_type;
};