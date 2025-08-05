import { QueryInterface, DataTypes, QueryTypes, Sequelize } from "sequelize";
 
 /** @type {import("sequelize-cli").Migration} */
 module.exports = {
   up: (queryInterface: QueryInterface): Promise<void> =>
     queryInterface.sequelize.transaction(async (transaction) => {
       // here go all migration changes
       await queryInterface.createTable("mst_ai_llm_recording", {
         id: {
           allowNull: false,
           autoIncrement: true,
           primaryKey: true,
           type: DataTypes.INTEGER,
         },
         key: {
           type: DataTypes.STRING,
           allowNull: false,
           unique: true,
         },
         name: {
           type: DataTypes.STRING,
           allowNull: false,
         },
         is_enabled: {
           type: DataTypes.BOOLEAN,
           defaultValue: true,
         },
        is_video: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        is_audio: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
         createdAt: {
           allowNull: false,
           type: DataTypes.DATE,
           defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
         },
         updatedAt: {
           allowNull: false,
           type: DataTypes.DATE,
           defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
         },
         deletedAt: {
           type: DataTypes.DATE,
         },
       });
     }),
 
   down: (queryInterface: QueryInterface): Promise<void> =>
     queryInterface.sequelize.transaction(async (transaction) => {
       // here go all migration undo changes
       await queryInterface.dropTable("mst_ai_llm_recording");
     }),
 };