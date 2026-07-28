'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('queue_entries', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      visitUuid: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // a visit is in the queue at most once
      },
      patientId: { type: Sequelize.STRING, allowNull: true },
      patientName: { type: Sequelize.STRING, allowNull: true },
      specialty: { type: Sequelize.STRING, allowNull: false },
      status: {
        type: Sequelize.ENUM('WAITING', 'ASSIGNED', 'IN_CALL', 'COMPLETED', 'CANCELLED', 'STALE'),
        allowNull: false,
        defaultValue: 'WAITING',
      },
      priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      doctorId: { type: Sequelize.STRING, allowNull: true },
      roomId: { type: Sequelize.STRING, allowNull: true },
      enqueuedAt: { type: Sequelize.DATE, allowNull: true },
      assignedAt: { type: Sequelize.DATE, allowNull: true },
      startedAt: { type: Sequelize.DATE, allowNull: true },
      completedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, {
      engine: 'InnoDB', // required for FOR UPDATE SKIP LOCKED
    });

    // composite index used by the claim / position / list queries
    // (visitUuid already has a unique index from the column definition above)
    await queryInterface.addIndex('queue_entries', ['specialty', 'status', 'priority', 'enqueuedAt'], {
      name: 'idx_specialty_status_order',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('queue_entries');
    // clean up the ENUM type (harmless on MySQL, matters on Postgres)
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_queue_entries_status";');
    }
  },
};
