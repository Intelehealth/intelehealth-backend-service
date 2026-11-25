import { QueryInterface } from 'sequelize';

/**
 * "NCD Screening" switch: when enabled, the health worker app runs the NCD (DM & HTN)
 * consent/eligibility screening flow when a visit is started. Seeded OFF, so deploying changes
 * nothing until an admin turns it on (Admin Actions → NCD Screening → toggle + Publish).
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'ncd_section', name: 'NCD Screening Section', is_enabled: false, platform: 'Both' },
      ], { transaction });

      await queryInterface.bulkInsert('dic_config', [
        { key: 'ncd_section', value: false, type: 'boolean', default_value: false },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['ncd_section'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['ncd_section'] }, { transaction });
    })
};
