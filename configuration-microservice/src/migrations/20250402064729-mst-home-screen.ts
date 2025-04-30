import { QueryInterface, DataTypes, Sequelize } from 'sequelize';

/** @type {import("sequelize-cli").Migration} */
module.exports = {
    up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
        async () => {
          // here go all migration changes
          await queryInterface.createTable('mst_home_screen', {
            id: {
              allowNull: false,
              autoIncrement: true,
              primaryKey: true,
              type: DataTypes.INTEGER,
            },
            name: {
              type: DataTypes.STRING,
              allowNull: true,
            },
            lang: {
              type: DataTypes.JSON,
              allowNull: true,
            },
            label: {
              type: DataTypes.ENUM('0', '1', '2'),
              allowNull: true,
            },
            key: {
              type: DataTypes.STRING,
              allowNull: false,
              unique: true,
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
          });
        }
    ),

    down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
        async () => {
          // here go all migration undo changes
          await queryInterface.dropTable('mst_home_screen');
        }
    ),
};
