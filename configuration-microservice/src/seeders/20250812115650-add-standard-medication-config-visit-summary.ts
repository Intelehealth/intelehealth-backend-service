import { QueryInterface} from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_patient_visit_summary', [
        { name: 'Standard Medication', is_enabled: false },
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_patient_visit_summary'
        , { name: [ 'Standard Medication'] }, { transaction });
    })
};