import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_patient_visit_summary', [
        { name: 'Notes Section', is_enabled: true },
        { name: 'Attachment Section', is_enabled: true },
        { name: 'Doctor Specialty Section', is_enabled: true },
        { name: 'Priority Visit Section', is_enabled: true },
        { name: 'Appointment Button', is_enabled: true },
        { name: 'Severity of Case Section', is_enabled: true },
        { name: 'Facility to Visit Section', is_enabled: true }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_patient_visit_summary', {}, { transaction });
    })
};
