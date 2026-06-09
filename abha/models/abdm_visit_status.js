"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class abdm_visit_status extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  abdm_visit_status.init(
    {
      visitUuid: DataTypes.STRING,
      requestId: DataTypes.STRING,
      requestData: DataTypes.JSON,
      error: DataTypes.JSON,
      link_status_error: DataTypes.JSON,
      response: DataTypes.JSON,
      link_status_response: DataTypes.JSON,
      isLinked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isInvalid: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      inProcessInCron: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      hiTypes: DataTypes.STRING
    },
    {
      sequelize,
      modelName: "abdm_visit_status",
      tableName: 'abdm_visit_status'
    }
  );
  return abdm_visit_status;
};
