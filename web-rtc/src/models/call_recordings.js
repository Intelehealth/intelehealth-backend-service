'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class call_recordings extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define associations if needed
    }
  }

  call_recordings.init({
    doctor_id: DataTypes.STRING,
    patient_id: DataTypes.STRING,
    file_path: DataTypes.STRING,
    visit_id: DataTypes.STRING,
    chw_id: DataTypes.STRING,
    room_id: DataTypes.STRING,
    egress_id: DataTypes.STRING,
    s3_url: DataTypes.STRING,
    start_time: DataTypes.DATE,
    end_time: DataTypes.DATE,
  }, 
  {
    sequelize,
    modelName: 'call_recordings',
  });

  return call_recordings;
};
