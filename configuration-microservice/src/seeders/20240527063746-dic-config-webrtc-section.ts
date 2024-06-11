import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */
      await queryInterface.bulkInsert('dic_config', [
        {
          key: 'webrtc_section',
          value: true,
          type: 'boolean',
          default_value: true
        },
        {
          key: 'patient_vitals_section',
          value: true,
          type: 'boolean',
          default_value: true
        },
        {
          key: 'patient_reg_address',
          value: true,
          type: 'boolean',
          default_value: true
        },
        {
          key: 'patient_reg_other',
          value: true,
          type: 'boolean',
          default_value: true
        }
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'webrtc_section' }, { transaction });
    })
};
