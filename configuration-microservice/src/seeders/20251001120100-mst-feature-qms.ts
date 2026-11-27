import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'qms_section', name: 'QMS Section', is_enabled: false, platform: 'Both' },
      ], { transaction });

      await queryInterface.bulkInsert('dic_config', [
        { key: 'qms_section', value: false, type: 'boolean', default_value: false },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['qms_section'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['qms_section'] }, { transaction });
    })
};
