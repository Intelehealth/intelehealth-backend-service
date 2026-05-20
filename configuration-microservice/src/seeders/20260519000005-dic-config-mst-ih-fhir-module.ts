import { QueryInterface } from 'sequelize';

const ihFhirModuleConfig = {
  fhir: true,
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('dic_config', [
        {
          key: 'fhir_module',
          value: JSON.stringify(ihFhirModuleConfig),
          type: 'json',
          default_value: JSON.stringify(ihFhirModuleConfig),
        },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('dic_config', { key: 'fhir_module' }, { transaction });
    }),
};
