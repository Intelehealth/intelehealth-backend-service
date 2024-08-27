import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */
      await queryInterface.bulkUpdate('dic_config', 
        {
          key: 'patient_visit_summary',
          value: JSON.stringify({
            notes_section: true,
            attachment_section: true,
            doctor_specialty_section: true,
            priority_visit_section: true,
            appointment_button: true,
            severity_of_case_section: true,
            facility_to_visit_section: true,
            generate_bill_button: true,
            completed_visit_section: false,
            restrict_end_visit_till_prescription_download: false
          }),
          type: 'json',
          default_value: JSON.stringify({
            notes_section: true,
            attachment_section: true,
            doctor_specialty_section: true,
            priority_visit_section: true,
            appointment_button: true,
            severity_of_case_section: true,
            facility_to_visit_section: true,
            generate_bill_button: false,
            completed_visit_section: false,
            restrict_end_visit_till_prescription_download: false
          })
        },{
          key: 'patient_visit_summary'
        },
        { transaction
        }
      );

      await queryInterface.bulkInsert('mst_patient_visit_summary', [
        { name: 'Restrict End Visit Till Prescription Download', is_enabled: true }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Delete not required as it will get deleted from it's main seeder file
       */
      // await queryInterface.bulkDelete('dic_config', { key: 'patient_visit_summary' }, { transaction });
    })
};
