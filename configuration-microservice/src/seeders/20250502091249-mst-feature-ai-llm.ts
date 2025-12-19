import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'ai_llm_section', name: 'AI LLM Section', is_enabled: true },
      ], { transaction });

      await queryInterface.bulkInsert('dic_config', [
        { key: 'ai_llm_section', value: true, type: 'boolean', default_value: true },
        {
          key: 'ai_llm',
          value: JSON.stringify({ differential_diagnosis: true, treatment_plan: true }),
          type: 'json',
          default_value: JSON.stringify({ differential_diagnosis: true, treatment_plan: true }),
        }
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['ai_llm_section'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['ai_llm_section', 'ai_llm'] }, { transaction });
    })
};

