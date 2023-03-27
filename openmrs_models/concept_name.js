'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class concept_name extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  concept_name.init({
    concept_name_id: DataTypes.INTEGER,
    concept_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    locale: DataTypes.STRING,
    locale_preferred: DataTypes.BOOLEAN,
    creator: DataTypes.INTEGER,
    date_created: DataTypes.DATE,
    concept_name_type: DataTypes.STRING,
    voided: DataTypes.BOOLEAN,
    voided_by: DataTypes.INTEGER,
    date_voided: DataTypes.DATE,
    void_reason: DataTypes.STRING,
    uuid: DataTypes.STRING,
    date_changed: DataTypes.DATE,
    changed_by: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'concept_name',
  });
  return concept_name;
};