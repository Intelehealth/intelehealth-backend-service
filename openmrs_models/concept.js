'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class concept extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasMany(models.concept_name, {
        as: "concept_name",
        foreignKey: "concept_id",
        sourceKey: "concept_id",
      });
    }
  };
  concept.init({
    concept_id:{
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    retired: DataTypes.BOOLEAN,
    short_name: DataTypes.STRING,
    description: DataTypes.TEXT,
    form_text: DataTypes.TEXT,
    datatype_id: DataTypes.INTEGER,
    class_id: DataTypes.INTEGER,
    is_set: DataTypes.BOOLEAN,
    creator: DataTypes.INTEGER,
    date_created: DataTypes.DATE,
    version: DataTypes.STRING,
    changed_by: DataTypes.INTEGER,
    date_changed: DataTypes.DATE,
    retired_by: DataTypes.INTEGER,
    date_retired: DataTypes.DATE,
    retire_reason: DataTypes.STRING,
    uuid: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'concept',
  });
  return concept;
};