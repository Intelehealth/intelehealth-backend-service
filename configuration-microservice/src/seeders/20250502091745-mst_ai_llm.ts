import { QueryInterface } from "sequelize";

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        "mst_ai_llm",
        [
          { key: "differential_diagnosis", name: "Differential Diagnosis (DDx)", is_enabled: true },
          { key: "treatment_plan", name: "Treatment Plan (Tx)", is_enabled: true },
        ],
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        "mst_ai_llm",
        {
          key: ["differential_diagnosis", "treatment_plan"],
        },
        { transaction }
      );
    }),
};
