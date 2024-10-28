import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */
      await queryInterface.bulkUpdate('dic_config', {
          default_value: JSON.stringify({
            notes_section: true,
            attachment_section: true,
            doctor_specialty_section: true,
            priority_visit_section: true,
            appointment_button: true,
            severity_of_case_section: true,
            facility_to_visit_section: true,
            hw_followup_section: true
          })
        },
        {
          key: 'patient_visit_summary'
        }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'patient_visit_summary' }, { transaction });
    })
};
