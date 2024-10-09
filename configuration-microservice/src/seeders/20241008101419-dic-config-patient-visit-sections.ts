import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async () => {
      /**
       * Add seed commands here.
      */
      const pvs = [
        { name: JSON.stringify({ en: "Consultation Details" }), key: 'consultation_details', order: 1, is_editable: false, is_enabled: true, is_locked: true },
        { name: JSON.stringify({ en: "Vitals" }), key: 'vitals', order: 2, is_editable: true, is_enabled: true, is_locked: false },
        { name: JSON.stringify({ en: "Check Up Reason" }), key: 'check_up_Reason', order: 3, is_editable: false, is_enabled: true, is_locked: true },
        { name: JSON.stringify({ en: "Physical examination" }), key: 'physical_examination', order: 4, is_editable: true, is_enabled: true, is_locked: false },
        { name: JSON.stringify({ en: "Medical history" }), key: 'medical_history', order: 5, is_editable: true, is_enabled: true, is_locked: false },
        { name: JSON.stringify({ en: "Additional Notes" }), key: 'additional_notes', order: 6, is_editable: true, is_enabled: true, is_locked: false },
        { name: JSON.stringify({ en: "Additional Documents" }), key: 'additional_documents', order: 7, is_editable: true, is_enabled: true, is_locked: false },
        { name: JSON.stringify({ en: "Refer to Specialist" }), key: 'refer_to_specialist', order: 8, is_editable: true, is_enabled: true, is_locked: false },
      ]
      await queryInterface.bulkInsert('dic_config', [
        {
          key: 'patient_visit_sections',
          value: JSON.stringify(pvs),
          type: 'array',
          default_value: JSON.stringify(pvs)
        }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'patient_visit_sections' }, { transaction });
    })
};
