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
        { name: 'Data privacy policy', key: 'o_data_privacy_policy', section: 'Other', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Telemedicine consent policy', key: 'o_telemedicine_consent_policy', section: 'Other', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
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
