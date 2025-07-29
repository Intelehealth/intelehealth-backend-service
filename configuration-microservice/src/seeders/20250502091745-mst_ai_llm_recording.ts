import { QueryInterface } from "sequelize";

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        "mst_ai_llm_recording",
        [
          { key: "ai_video", name: "Video", is_enabled: true,is_video: true,is_audio: false},
          { key: "ai_audio", name: "Audio", is_enabled: true,is_video: false,is_audio: true },
        ],
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        "mst_ai_llm_recording",
        {
          key: ["ai_video","ai_audio"],
        },
        { transaction }
      );
    }),
};
