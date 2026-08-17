"use strict";

/** doctor_service_stats — backend LLD §02.3 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("doctor_service_stats", {
      doctor_uuid: { type: Sequelize.STRING(64), primaryKey: true, allowNull: false },
      speciality: { type: Sequelize.STRING(100), allowNull: true },
      avg_consult_min: { type: Sequelize.DOUBLE, allowNull: true },
      consult_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      rating: { type: Sequelize.DOUBLE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex("doctor_service_stats", ["speciality"], {
      name: "idx_doctor_stats_speciality",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("doctor_service_stats");
  },
};
