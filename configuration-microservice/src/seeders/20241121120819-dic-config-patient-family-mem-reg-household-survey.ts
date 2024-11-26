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
          key: 'patient_family_member_registration',
          value: true,
          type: 'boolean',
          default_value: true
        },
        {
          key: 'patient_household_survey',
          value: true,
          type: 'boolean',
          default_value: true
        },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: ['patient_family_member_registration', 'patient_household_survey']}, { transaction });
    })
};
