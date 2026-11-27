'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class person_attribute_type extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  person_attribute_type.init({
    person_attribute_type_id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    name: DataTypes.STRING,
    description: DataTypes.STRING,
    format: DataTypes.STRING,
    searchable: DataTypes.TEXT,
    edit_privilege: DataTypes.STRING,
    sort_weight: DataTypes.INTEGER,
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
    modelName: 'person_attribute_type',
  });
  return person_attribute_type;
};