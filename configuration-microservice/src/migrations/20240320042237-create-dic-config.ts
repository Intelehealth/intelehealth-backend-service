import { QueryInterface, DataTypes, QueryTypes, Sequelize } from 'sequelize';

/** @type {import("sequelize-cli").Migration} */
module.exports = {
    up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
        async (transaction) => {
          // here go all migration changes
          await queryInterface.createTable('dic_config', {
            id: {
              allowNull: false,
              autoIncrement: true,
              primaryKey: true,
              type: DataTypes.INTEGER,
            },
            key: {
              type: DataTypes.STRING,
              allowNull: false,
              unique: true
            },
            value: {
              type: DataTypes.TEXT
            },
            type: {
              type: DataTypes.ENUM,
              allowNull: false,
              values:['string','number','boolean','array','json']
            },
            default_value: {
              type: DataTypes.TEXT,
              defaultValue: null
            },
            published: {
              allowNull: false,
              type: DataTypes.BOOLEAN,
              defaultValue: false
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
          await queryInterface.dropTable('dic_config');
        }
    )
};