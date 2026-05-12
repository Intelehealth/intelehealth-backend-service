import { QueryInterface} from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_patient_visit_sections', [
        { name: 'Digital Stethoscope',  lang: JSON.stringify({en: "Digital Stethoscope"}), key: 'digital_stethoscope', order: 11, is_editable: true, is_enabled: true, is_locked: false, platform: 'Both'},
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_patient_visit_sections', { key: ['digital_stethoscope'] }, { transaction });
    })
};