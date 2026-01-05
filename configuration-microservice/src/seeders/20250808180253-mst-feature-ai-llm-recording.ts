import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'ai_llm_recording_section', name: 'AI LLM Recording Section', is_enabled: true },
      ], { transaction });

      await queryInterface.bulkInsert('dic_config', [
        { key: 'ai_llm_recording_section', value: true, type: 'boolean', default_value: true },
        {
          key: 'ai_llm_recording',
          value: JSON.stringify({ ai_audio: true, ai_video: true }),
          type: 'json',
          default_value: JSON.stringify({ ai_audio: true, ai_video: true }),
        }
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['ai_llm_recording_section'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['ai_llm_recording_section', 'ai_llm_recording'] }, { transaction });
    })
};

