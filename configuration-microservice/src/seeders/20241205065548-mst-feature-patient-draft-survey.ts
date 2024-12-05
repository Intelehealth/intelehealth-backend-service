import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'patient_draft_survey', name: 'Patient Draft Survey', is_enabled: true },
      ], { transaction });
      await queryInterface.bulkInsert('dic_config', [
        { key: 'patient_draft_survey', value: true, type: 'boolean', default_value: true },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['patient_draft_survey'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['patient_draft_survey'] }, { transaction });
    })
};
