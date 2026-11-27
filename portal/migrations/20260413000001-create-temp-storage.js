'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('temp_storage', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      resource_type: {
        allowNull: false,
        type: Sequelize.ENUM('patient', 'visit', 'asset')
      },
      resource_id: {
        allowNull: false,
        type: Sequelize.STRING(255)
      },
      parent_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      parent_type: {
        type: Sequelize.ENUM('patient', 'visit', 'asset'),
        allowNull: true
      },
      data: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      file_path: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      sync_status: {
        allowNull: false,
        type: Sequelize.ENUM('pending', 'synced'),
        defaultValue: 'pending'
      },
      synced_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_by: {
        allowNull: false,
        type: Sequelize.STRING(255)
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Unique composite index on (resource_type, resource_id)
    await queryInterface.addIndex('temp_storage', ['resource_type', 'resource_id'], {
      unique: true,
      name: 'idx_temp_storage_type_resource'
    });

    // Index on (parent_type, parent_id) for hierarchy queries
    await queryInterface.addIndex('temp_storage', ['parent_type', 'parent_id'], {
      name: 'idx_temp_storage_parent'
    });

    // Index on (sync_status, updatedAt) for cron cleanup queries
    await queryInterface.addIndex('temp_storage', ['sync_status', 'updatedAt'], {
      name: 'idx_temp_storage_sync_status'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('temp_storage');
  }
};
