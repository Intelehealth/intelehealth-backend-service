import { QueryInterface, DataTypes } from 'sequelize';

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.addColumn('mst_specialization', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_language', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_patient_registration', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('theme_config', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_patient_vital', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_webrtc', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_patient_visit_summary', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_features', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_patient_diagnostic', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_sidebar_menu', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_patient_visit_sections', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_roster_questionnaire', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_dropdown_values', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
      queryInterface.addColumn('mst_home_screen', 'platform', {
        type: DataTypes.ENUM('Mobile', 'Webapp', 'Both'),
        allowNull: true,
      }),
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await Promise.all([
        queryInterface.removeColumn('mst_specialization', 'platform'),
        queryInterface.removeColumn('mst_language', 'platform'),
        queryInterface.removeColumn('mst_patient_registration', 'platform'),
        queryInterface.removeColumn('theme_config', 'platform'),
        queryInterface.removeColumn('mst_patient_vital', 'platform'),
        queryInterface.removeColumn('mst_webrtc', 'platform'),
        queryInterface.removeColumn('mst_patient_visit_summary', 'platform'),
        queryInterface.removeColumn('mst_features', 'platform'),
        queryInterface.removeColumn('mst_patient_diagnostic', 'platform'),
        queryInterface.removeColumn('mst_sidebar_menu', 'platform'),
        queryInterface.removeColumn('mst_patient_visit_sections', 'platform'),
        queryInterface.removeColumn('mst_roster_questionnaire', 'platform'),
        queryInterface.removeColumn('mst_dropdown_values', 'platform'),
        queryInterface.removeColumn('mst_home_screen', 'platform'),
    ]);
  }
};



