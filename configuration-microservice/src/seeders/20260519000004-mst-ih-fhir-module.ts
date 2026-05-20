import { QueryInterface } from 'sequelize';

const ihFhirModule = [
  {
    name: 'FHIR Module',
    lang: JSON.stringify({ en: 'FHIR Module' }),
    key: 'fhir',
    order: 1,
    is_editable: true,
    is_enabled: true,
    is_locked: false,
    sub_sections: JSON.stringify([]),
    platform: 'Both',
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_ih_fhir_module', ihFhirModule, { transaction });
    }
  ),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_ih_fhir_module', {}, { transaction });
    }
  ),
};
