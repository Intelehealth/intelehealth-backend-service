import { QueryInterface} from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_patient_visit_summary', [
        { name: 'Allow Duplicate PhoneNo And Email', is_enabled: false },
        { name: 'Share Prescription', is_enabled: true },
        { name: 'Share Patient Visit Summary', is_enabled: true },
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_patient_visit_summary'
        , { name: [ 'Allow Duplicate PhoneNo And Email','Share Prescription','Share Patient Visit Summary'] }, { transaction });
    })
};
