'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class person_name extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  person_name.init({
    person_name_id: DataTypes.INTEGER,
    preferred: DataTypes.BOOLEAN,
    person_id: DataTypes.INTEGER,
    prefix: DataTypes.STRING,
    given_name: DataTypes.STRING,
    middle_name: DataTypes.STRING,
    family_name_prefix: DataTypes.STRING,
    family_name: DataTypes.STRING,
    family_name2: DataTypes.STRING,
    family_name_suffix: DataTypes.STRING,
    degree: DataTypes.STRING,
    creator: DataTypes.INTEGER,
    date_created: DataTypes.DATE,
    voided: DataTypes.BOOLEAN,
    voided_by: DataTypes.INTEGER,
    date_voided: DataTypes.DATE,
    void_reason: DataTypes.STRING,
    changed_by: DataTypes.INTEGER,
    date_changed: DataTypes.DATE,
    uuid: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'person_name',
  });
  return person_name;
};