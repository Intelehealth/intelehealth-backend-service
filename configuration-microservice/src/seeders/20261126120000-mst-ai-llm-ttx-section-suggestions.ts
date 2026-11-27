import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        "mst_ai_llm",
        [
          {
            key: "ai_ttx_advice",
            name: "AI-Suggested Advice",
            is_enabled: false,
          },
          {
            key: "ai_ttx_investigation",
            name: "AI-Suggested Investigations",
            is_enabled: false,
          },
          {
            key: "ai_ttx_referral",
            name: "AI-Suggested Referral",
            is_enabled: false,
          },
          {
            key: "ai_ttx_followup",
            name: "AI-Suggested Follow-up",
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
            "ai_ttx_advice",
            "ai_ttx_investigation",
            "ai_ttx_referral",
            "ai_ttx_followup",
          ],
        },
        { transaction }
      );
    }),
};
