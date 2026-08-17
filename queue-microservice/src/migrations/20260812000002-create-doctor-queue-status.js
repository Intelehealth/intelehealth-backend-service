"use strict";

/** doctor_queue_status — backend LLD §02.2 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("doctor_queue_status", {
      doctor_uuid: { type: Sequelize.STRING(64), primaryKey: true, allowNull: false },
      speciality: { type: Sequelize.STRING(100), allowNull: true },
      status: {
        type: Sequelize.ENUM("online", "offline", "in_consult", "away"),
        allowNull: false,
        defaultValue: "offline",
      },
      current_queue_entry_id: { type: Sequelize.INTEGER, allowNull: true },
      last_changed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex("doctor_queue_status", ["speciality", "status"], {
      name: "idx_doctor_status_speciality",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("doctor_queue_status");
  },
};
