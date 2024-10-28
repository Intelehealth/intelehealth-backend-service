import { QueryInterface, DataTypes, QueryTypes, Sequelize } from 'sequelize';

/** @type {import("sequelize-cli").Migration} */
module.exports = {
    up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
        async (transaction) => {
          // here go all migration changes
          await queryInterface.createTable('audit_trail', {
            id: {
              allowNull: false,
              autoIncrement: true,
              primaryKey: true,
              type: DataTypes.INTEGER,
            },
            user_id: {
              type: DataTypes.STRING,
              allowNull: false
            },
            user_name: {
              type: DataTypes.STRING
            },
            activity_type: {
              type: DataTypes.ENUM,
              values:['CONFIG PUBLISHED', 'SPECIALIZATION STATUS UPDATED', 'LANGUAGE STATUS UPDATED', 'LANGUAGE SET AS DEFAULT', 'PATIENT REGISTRATION FIELD STATUS UPDATED', 'PATIENT REGISTRATION FIELD MANDATORY STATUS UPDATED', 'PATIENT REGISTRATION FIELD EDITABLE STATUS UPDATED', 'THEME CONFIG UPDATED', 'VITAL ENABLED STATUS UPDATED', 'VITAL MANDATORY STATUS UPDATED', 'WEBRTC CONFIG UPDATED', 'FEATURE CONFIG UPDATED', 'PATIENT VISIT SUMMARY SECTION STATUS UPDATED', 'DIAGNOSTIC MANDATORY STATUS UPDATED', 'DIAGNOSTIC ENABLED STATUS UPDATED']
            },
            description: {
              type: DataTypes.TEXT,
              allowNull: true,
              defaultValue: null
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
            }
          });
        }
    ),

    down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
        async (transaction) => {
          // here go all migration undo changes
          await queryInterface.dropTable('audit_trail');
        }
    )
};