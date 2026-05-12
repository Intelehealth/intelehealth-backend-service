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
      await queryInterface.bulkInsert('mst_patient_visit_sections', [
        { name: 'Share Prescription', lang: JSON.stringify({ en: "Share Prescription" }), key: 'share_prescription', order: 12, is_editable: true, is_enabled: true, is_locked: false, platform: 'Mobile' },
        { name: 'Share Patient Visit Summary', lang: JSON.stringify({ en: "Share Patient Visit Summary" }), key: 'share_patient_visit_summary', order: 13, is_editable: true, is_enabled: true, is_locked: false, platform: 'Mobile' },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       *
       * Example:
       * await queryInterface.bulkDelete('People', null, {});
       */
      await queryInterface.bulkDelete('mst_patient_visit_sections', {}, { transaction });
    })
};