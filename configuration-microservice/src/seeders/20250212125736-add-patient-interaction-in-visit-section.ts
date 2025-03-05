import { QueryInterface} from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_patient_visit_sections', [
        { name: 'Patient Interaction', key: 'patient_interaction', order: 10, is_editable: true, is_enabled: true, is_locked: false, lang: JSON.stringify({"en": "Patient Interaction"}), sub_sections: JSON.stringify([{"name": "HW", "is_enabled": true},{"name": "Patient", "is_enabled": true},{ "name": "Comment", "is_enabled": false }])},
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_patient_visit_sections', { key: ['patient_interaction'] }, { transaction });
    })
};