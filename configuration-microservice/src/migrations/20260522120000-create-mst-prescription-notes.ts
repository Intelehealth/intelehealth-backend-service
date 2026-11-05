import { QueryInterface, DataTypes, Sequelize } from "sequelize";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "mst_prescription_notes",
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER,
          },
          specialty: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
          },
          notes: {
            type: DataTypes.JSON,
            allowNull: false,
          },
          is_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
          },
          platform: {
            type: DataTypes.ENUM("Mobile", "Webapp", "Both"),
            allowNull: true,
          },
          createdAt: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updatedAt: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: Sequelize.literal(
              "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
            ),
          },
        },
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("mst_prescription_notes", { transaction });
    }),
};
