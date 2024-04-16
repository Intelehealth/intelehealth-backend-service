import { QueryInterface, DataTypes, QueryTypes, Sequelize } from 'sequelize';

/** @type {import("sequelize-cli").Migration} */
module.exports = {
    up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
        async (transaction) => {
          // here go all migration changes
          await queryInterface.createTable('mst_patient_registration', {
            id: {
              allowNull: false,
              autoIncrement: true,
              primaryKey: true,
              type: DataTypes.INTEGER,
            },
            name: {
              type: DataTypes.STRING,
              allowNull: false,
              unique: true
            },
            section: {
              type: DataTypes.ENUM,
              values: ['Personal','Address','Other'],
              allowNull: false,
            },
            is_mandatory: {
              type: DataTypes.BOOLEAN,
              defaultValue: false,
            },
            is_editable: {
              type: DataTypes.BOOLEAN,
              defaultValue: false,
            },
            is_enabled: {
              type: DataTypes.BOOLEAN,
              defaultValue: false,
            },
            is_locked: {
              type: DataTypes.BOOLEAN,
              defaultValue: false,
            },
            createdAt: {
              allowNull: false,
              type: DataTypes.DATE,
              defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updatedAt: {
              allowNull: false,
              type: DataTypes.DATE,
              defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
            },
            deletedAt: {
              type: DataTypes.DATE,
            },
          });
        }
    ),

    down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
        async (transaction) => {
          // here go all migration undo changes
          await queryInterface.dropTable('mst_patient_registration');
        }
    )
};