import { QueryInterface } from "sequelize";

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        "mst_ai_llm",
        [
          {
            key: "ai_ddx_precompute",
            name: "AI DDx Auto-Compute",
            is_enabled: true,
          },
        ],
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        "mst_ai_llm",
        {
          key: ["ai_ddx_precompute"],
        },
        { transaction }
      );
    }),
};
