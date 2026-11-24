import { QueryInterface } from "sequelize";

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        "mst_ai_llm",
        [
          {
            key: "json_format_visit_summary_ddx",
            name: "JSON format visit summary - DDx",
            is_enabled: false,
          },
          {
            key: "json_format_visit_summary_ttx",
            name: "JSON format visit summary - TTx",
            is_enabled: false,
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
          key: [
            "json_format_visit_summary_ddx",
            "json_format_visit_summary_ttx",
          ],
        },
        { transaction }
      );
    }),
};
