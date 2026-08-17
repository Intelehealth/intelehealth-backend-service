"use strict";

/** queue_entries — backend LLD §02.1 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("queue_entries", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },

      visit_uuid: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      patient_uuid: { type: Sequelize.STRING(64), allowNull: true },
      hw_user_uuid: { type: Sequelize.STRING(64), allowNull: false },
      speciality: { type: Sequelize.STRING(100), allowNull: false },
      location_uuid: { type: Sequelize.STRING(64), allowNull: true },

      emergency_level: {
        type: Sequelize.ENUM("CRITICAL", "HIGH", "MEDIUM", "LOW"),
        allowNull: false,
        defaultValue: "LOW",
      },
      requested_emergency_level: {
        type: Sequelize.ENUM("CRITICAL", "HIGH", "MEDIUM", "LOW"),
        allowNull: true,
      },
      case_type: {
        type: Sequelize.ENUM("NEW", "REFERRAL", "FOLLOW_UP"),
        allowNull: false,
        defaultValue: "NEW",
      },
      spec_match: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "EXACT",
      },
      flagged: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

      vitals: { type: Sequelize.JSON, allowNull: true },
      chief_complaint: { type: Sequelize.TEXT, allowNull: true },

      priority_score: { type: Sequelize.DOUBLE, allowNull: false, defaultValue: 0 },
      base_score: { type: Sequelize.DOUBLE, allowNull: false, defaultValue: 0 },
      cumulative_aging_applied: { type: Sequelize.DOUBLE, allowNull: false, defaultValue: 0 },
      score_before_assignment: { type: Sequelize.DOUBLE, allowNull: true },

      status: {
        type: Sequelize.ENUM(
          "SUBMITTED",
          "QUEUED",
          "ESCALATED",
          "ASSIGNED",
          "CONNECTING",
          "CONNECTED",
          "COMPLETED",
          "CANCELLED",
          "RE_QUEUED"
        ),
        allowNull: false,
        defaultValue: "SUBMITTED",
      },
      assigned_doctor_uuid: { type: Sequelize.STRING(64), allowNull: true },

      queued_at: { type: Sequelize.DATE, allowNull: true },
      assigned_at: { type: Sequelize.DATE, allowNull: true },
      connected_at: { type: Sequelize.DATE, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },

      initial_position: { type: Sequelize.INTEGER, allowNull: true },
      final_position: { type: Sequelize.INTEGER, allowNull: true },
      estimated_wait_min: { type: Sequelize.INTEGER, allowNull: true },
      initial_estimated_wait_min: { type: Sequelize.INTEGER, allowNull: true },
      eta_model_used: { type: Sequelize.ENUM("A", "B"), allowNull: true },

      escalated: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      escalated_at: { type: Sequelize.DATE, allowNull: true },
      requeue_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      last_heartbeat_at: { type: Sequelize.DATE, allowNull: true },
      heartbeat_flagged: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

      last_position_pushed: { type: Sequelize.INTEGER, allowNull: true },
      last_ewt_pushed: { type: Sequelize.INTEGER, allowNull: true },
      last_push_at: { type: Sequelize.DATE, allowNull: true },

      cancellation_reason: { type: Sequelize.TEXT, allowNull: true },
      completion_source: { type: Sequelize.STRING(32), allowNull: true },

      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex("queue_entries", ["status", "speciality"], {
      name: "idx_queue_entries_status_speciality",
    });
    await queryInterface.addIndex("queue_entries", ["assigned_doctor_uuid"], {
      name: "idx_queue_entries_assigned_doctor",
    });
    await queryInterface.addIndex("queue_entries", ["queued_at"], {
      name: "idx_queue_entries_queued_at",
    });
    // Backs the ordering read: the sorted-set equivalent (LLD §03).
    await queryInterface.addIndex(
      "queue_entries",
      ["speciality", "status", "emergency_level", "priority_score"],
      { name: "idx_queue_entries_lane" }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("queue_entries");
  },
};
