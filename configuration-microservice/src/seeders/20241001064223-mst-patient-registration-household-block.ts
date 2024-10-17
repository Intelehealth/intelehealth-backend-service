import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
       *
       * Example:
       * await queryInterface.bulkInsert('People', [{
       *   name: 'John Doe',
       *   isBetaMember: false
       * }], {});
      */
      await queryInterface.bulkInsert('mst_patient_registration', [
        { name: 'Block', key: 'a_block', section: 'Address', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Household Number', key: 'a_household_number', section: 'Address', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       *
       * Example:
       * await queryInterface.bulkDelete('People', null, {});
       */
      await queryInterface.bulkDelete('mst_patient_registration', {}, { transaction });
    })
};
