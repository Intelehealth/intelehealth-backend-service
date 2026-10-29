import { QueryInterface } from 'sequelize';

/**
 * "Visit Summary V2" switch: when enabled, the doctor webapp opens the new visit summary
 * (visit-summary-v2) instead of the old one. Seeded OFF, so deploying changes nothing until an
 * admin turns it on (Admin Actions → Visit Summary V2 → toggle + Publish).
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'visit_summary_v2_section', name: 'Visit Summary V2 Section', is_enabled: false, platform: 'Webapp' },
      ], { transaction });

      await queryInterface.bulkInsert('dic_config', [
        { key: 'visit_summary_v2_section', value: false, type: 'boolean', default_value: false },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['visit_summary_v2_section'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['visit_summary_v2_section'] }, { transaction });
    })
};
