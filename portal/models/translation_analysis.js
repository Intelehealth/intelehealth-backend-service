"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class translation_analysis extends Model {
       /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  translation_analysis.init( {
   id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      visitId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      conceptId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      is_rejected: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_datetime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      rejected_en_text: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      rejected_regional_text: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      api_failure_retry_counts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      updated_datetime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'translation_analysis',
      freezeTableName: true,               
      timestamps: false       
    }
  );
  return translation_analysis;
};
