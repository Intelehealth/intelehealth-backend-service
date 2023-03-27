'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class person extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  person.init({
    person_id: DataTypes.INTEGER,
    gender: DataTypes.STRING,
    birthdate: DataTypes.DATE,
    birthdate_estimated: DataTypes.BOOLEAN,
    dead:DataTypes.BOOLEAN,
    death_date: DataTypes.DATE,
    cause_of_death:DataTypes.INTEGER,
    creator:DataTypes.INTEGER,
    date_created: DataTypes.DATE,
    changed_by:DataTypes.INTEGER,
    date_changed:DataTypes.DATE,
    voided:DataTypes.BOOLEAN,
    voided_by:DataTypes.INTEGER,
    date_voided:DataTypes.DATE,
    void_reason: DataTypes.STRING,
    uuid: DataTypes.STRING,
    deathdate_estimated: DataTypes.BOOLEAN,
    birthtime: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'person',
  });
  return person;
};