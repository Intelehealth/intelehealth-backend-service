'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class call_data extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  call_data.init({
    doctor_id: DataTypes.STRING,
    visit_id: DataTypes.STRING,
    chw_id: DataTypes.STRING,
    room_id: DataTypes.STRING,
    call_status: DataTypes.STRING,
    call_duration: DataTypes.INTEGER,
    start_time: DataTypes.DATE,
    end_time: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'call_data',
  });
  return call_data;
};