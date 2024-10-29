import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async () => {
      /**
       * Add seed commands here.
      */
      const pvs = [
        { name: "Consultation Details", lang: JSON.stringify({ en: "Consultation Details" }), key: 'consultation_details', order: 1, is_enabled: true },
        { name: "Vitals", lang: JSON.stringify({ en: "Vitals" }), key: 'vitals', order: 2, is_enabled: true },
        { name: "Check Up Reason", lang: JSON.stringify({ en: "Check Up Reason" }), key: 'check_up_reason', order: 3, is_enabled: true },
        { name: "Physical examination", lang: JSON.stringify({ en: "Physical examination" }), key: 'physical_examination', order: 4, is_enabled: true },
        { name: "Medical history", lang: JSON.stringify({ en: "Medical history" }), key: 'medical_history', order: 5, is_enabled: true },
        { name: "Additional Notes", lang: JSON.stringify({ en: "Additional Notes" }), key: 'additional_notes', order: 6, is_enabled: true },
        { name: "Additional Documents", lang: JSON.stringify({ en: "Additional Documents" }), key: 'additional_documents', order: 7, is_enabled: true },
        { name: "Refer to Specialist", lang: JSON.stringify({ en: "Refer to Specialist" }), key: 'refer_to_specialist', order: 8, is_enabled: true },
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
