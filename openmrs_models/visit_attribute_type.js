'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class visit_attribute_type extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  visit_attribute_type.init({
    visit_attribute_type_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    description: DataTypes.STRING,
    datatype: DataTypes.STRING,
    datatype_config: DataTypes.TEXT,
    preferred_handler: DataTypes.STRING,
    handler_config: DataTypes.TEXT,
    min_occurs: DataTypes.INTEGER,
    max_occurs: DataTypes.INTEGER,
    creator: DataTypes.INTEGER,
    date_created: DataTypes.DATE,
    changed_by: DataTypes.INTEGER,
    date_changed: DataTypes.DATE,
    retired: DataTypes.BOOLEAN,
    retired_by: DataTypes.INTEGER,
    date_retired: DataTypes.DATE,
    retire_reason: DataTypes.STRING,
    uuid: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'visit_attribute_type',
  });
  return visit_attribute_type;
};