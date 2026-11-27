import { QueryInterface } from 'sequelize';

/**
 * "Mobilab" switch: when enabled, the apps use the Mobilab lab integration (lab tests, bookings
 * and reports via the mobilab-microservice). Seeded OFF, so deploying changes nothing until an
 * admin turns it on (Admin Actions → Mobilab → toggle + Publish).
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'mobilab_section', name: 'Mobilab Section', is_enabled: false, platform: 'Both' },
      ], { transaction });

      await queryInterface.bulkInsert('dic_config', [
        { key: 'mobilab_section', value: false, type: 'boolean', default_value: false },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['mobilab_section'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['mobilab_section'] }, { transaction });
    })
};
