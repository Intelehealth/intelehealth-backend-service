import { QueryInterface } from "sequelize";

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        "mst_roster_questionnaire",
        [
          { key: "general_roster", name: "General Roster", is_enabled: true },
          {
            key: "health_service_roster",
            name: "Health Service Roster",
            is_enabled: true,
          },
          {
            key: "pregnancy_roster",
            name: "Pregnancy Roster",
            is_enabled: true,
          },
        ],
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        "mst_roster_questionnaire",
        {
          key: ["general_roster", "health_service_roster", "pregnancy_roster"],
        },
        { transaction }
      );
    }),
};
