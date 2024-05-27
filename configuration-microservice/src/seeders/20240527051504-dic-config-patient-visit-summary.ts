import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */
      await queryInterface.bulkInsert('dic_config', [
        {
          key: 'patient_visit_summary',
          value: JSON.stringify({
            notes_section: true,
            attachment_section: true,
            doctor_specialty_section: true,
            priority_visit_section: true,
            appointment_button: true,
            severity_of_case_section: true,
            facility_to_visit_section: true
          }),
          type: 'json',
          default_value: JSON.stringify({
            notes_section: true,
            attachment_section: true,
            doctor_specialty_section: true,
            priority_visit_section: true,
            appointment_button: true,
            severity_of_case_section: true,
            facility_to_visit_section: true
          })
        }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'patient_visit_summary' }, { transaction });
    })
};
