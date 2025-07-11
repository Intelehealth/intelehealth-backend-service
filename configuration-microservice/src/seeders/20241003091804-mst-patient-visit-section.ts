import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_patient_visit_sections', [
        { name: "Consultation Details", lang: JSON.stringify({ en: "Consultation Details" }), key: 'consultation_details', order: 1, is_editable: true, is_enabled: true, is_locked: true },
        { name: "Vitals", lang: JSON.stringify({ en: "Vitals" }), key: 'vitals', order: 2, is_editable: true, is_enabled: true, is_locked: false },
        { name: "Diagnostics", lang: JSON.stringify({ en: "Diagnostics" }), key: 'diagnostics', order: 3, is_editable: true, is_enabled: true, is_locked: false },
        { name: "Check Up Reason", lang: JSON.stringify({ en: "Check Up Reason" }), key: 'check_up_reason', order: 4, is_editable: true, is_enabled: true, is_locked: true },
        { name: "Physical examination", lang: JSON.stringify({ en: "Physical examination" }), key: 'physical_examination', order: 5, is_editable: true, is_enabled: true, is_locked: false },
        { name: "Medical history", lang: JSON.stringify({ en: "Medical history" }), key: 'medical_history', order: 6, is_editable: true, is_enabled: true, is_locked: false },
        { name: "Additional Notes", lang: JSON.stringify({ en: "Additional Notes" }), key: 'additional_notes', order: 7, is_editable: true, is_enabled: true, is_locked: false },
        { name: "Additional Documents", lang: JSON.stringify({ en: "Additional Documents" }), key: 'additional_documents', order: 8, is_editable: true, is_enabled: true, is_locked: false },
        { name: "Refer to Specialist", lang: JSON.stringify({ en: "Refer to Specialist" }), key: 'refer_to_specialist', order: 9, is_editable: true, is_enabled: true, is_locked: false },
      ], { transaction }).catch((error) => {
        if (error.name === 'SequelizeValidationError') {
          error.errors.forEach((err: any) => {
        console.error(`Field: ${err.path}, Message: ${err.message}`);
          });
        } else {
          console.error("An unexpected error occurred:", error);
        }
      });
    }
  ),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_patient_visit_sections', {}, { transaction });
    }
  )
};
