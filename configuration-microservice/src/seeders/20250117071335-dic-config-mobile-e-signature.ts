import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction: any) => {
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
            restrict_end_visit_till_prescription_download: false,
            follow_up_visit_section: false,
            print_using_thermal_printer: false,
            hw_interaction: false,
            diagnosis_under_evaluation: false,
            past_medical_history_notes: false,
            family_history_notes: false,
            awaiting_visits_patient_type_demarcation: true,
            awaiting_visit_section: true,
            diagnosis_at_secondary_level: true,
            type_of_consultation: true,
            mobile_e_signature: true
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
            restrict_end_visit_till_prescription_download: false,
            follow_up_visit_section: false,
            print_using_thermal_printer: false,
            hw_interaction: false,
            diagnosis_under_evaluation: false,
            past_medical_history_notes: false,
            family_history_notes: false,
            awaiting_visits_patient_type_demarcation: true,
            awaiting_visit_section: true,
            diagnosis_at_secondary_level: true,
            type_of_consultation: true,
            mobile_e_signature: true
          })
        },{
          key: 'patient_visit_summary'
        },
        { transaction
        }
      );

      await queryInterface.bulkInsert('mst_patient_visit_summary', [
        { name: 'Mobile E Signature', is_enabled: true }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction: any) => {
      /**
       * Delete not required as it will get deleted from it's main seeder file
       */
      // await queryInterface.bulkDelete('dic_config', { key: 'patient_visit_summary' }, { transaction });
    })
};
