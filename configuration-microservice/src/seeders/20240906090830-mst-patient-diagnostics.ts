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
      await queryInterface.bulkInsert('mst_patient_diagnostic', [
        // { name: 'Blood Sugar', key: 'blood_sugar', uuid:'8df25ddf-ff39-4fa3-bd13-5dfbec8cb5ee', is_enabled: true, is_mandatory: false },
        { name: 'Fasting Blood Sugar (FBS) (mg/dl)', key: 'fasting_blood_sugar', uuid:'2dc7b9dd-825c-4061-a289-c939f758b10e', is_enabled: true, is_mandatory: false },
        { name: 'Random Blood Sugar (RBS) (mg/dl)', key: 'random_blood_sugar', uuid:'dab6dfb4-0560-42d6-a5f6-af04085c3358', is_enabled: true, is_mandatory: false },
        { name: 'Post Prandial Blood Sugar (PPBS) (mg/dl)', key: 'post_prandial_blood_sugar', uuid:'b0a7d2b6-64ba-4597-bde3-63623c8237ef', is_enabled: true, is_mandatory: false },
        { name: 'Hemoglobin', key: 'hemoglobin', uuid:'8f1993c4-c460-4715-86f8-c4c582ef4b3d', is_enabled: true, is_mandatory: false },
        { name: 'Uric Acid', key: 'uric_acid', uuid:'366e11ae-f6a2-4c27-8285-5bc496f9dfb4', is_enabled: true, is_mandatory: false },
        { name: 'Total Cholesterol', key: 'total_cholesterol', uuid:'24914ddd-b97a-400e-a7e1-171ec8fb77d0', is_enabled: true, is_mandatory: false },
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
      await queryInterface.bulkDelete('mst_patient_diagnostic', {}, { transaction });
    })
};
