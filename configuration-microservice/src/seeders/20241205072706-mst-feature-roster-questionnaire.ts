import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'roster_questionnaire_section', name: 'Roster Questionnaire Section', is_enabled: true },
      ], { transaction });

      await queryInterface.bulkInsert('dic_config', [
        { key: 'roster_questionnaire_section', value: true, type: 'boolean', default_value: true },
        {
          key: 'roster_questionnaire',
          value: JSON.stringify({ general_roster: true, pregnancy_roster: true, health_service_roster: true },),
          type: 'json',
          default_value: JSON.stringify({ general_roster: true, pregnancy_roster: true, health_service_roster: true },),
        }
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['roster_questionnaire_section'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['roster_questionnaire_section', 'roster_questionnaire'] }, { transaction });
    })
};
