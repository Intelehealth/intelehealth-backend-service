import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'namco_referral_section', name: 'Namco Referral Section', is_enabled: true, platform: 'Both' },
      ], { transaction });

      await queryInterface.bulkInsert('dic_config', [
        { key: 'namco_referral_section', value: true, type: 'boolean', default_value: true },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['namco_referral_section'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['namco_referral_section'] }, { transaction });
    })
};
