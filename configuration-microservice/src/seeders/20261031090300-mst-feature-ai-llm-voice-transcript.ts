import { QueryInterface } from 'sequelize';

const VOICE_TRANSCRIPT_CONFIG = JSON.stringify({
  record_transcribe_webapp: false,
  record_transcribe_mobile: false,
  feed_ai_ddx: false,
  autofill_doctor_notes: false,
});

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_features', [
        { key: 'ai_llm_voice_transcript_section', name: 'Voice Transcript', is_enabled: false, platform: 'Both' },
      ], { transaction });

      await queryInterface.bulkInsert('dic_config', [
        { key: 'ai_llm_voice_transcript_section', value: false, type: 'boolean', default_value: false },
        {
          key: 'ai_llm_voice_transcript',
          value: VOICE_TRANSCRIPT_CONFIG,
          type: 'json',
          default_value: VOICE_TRANSCRIPT_CONFIG,
        },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_features', { key: ['ai_llm_voice_transcript_section'] }, { transaction });
      await queryInterface.bulkDelete('dic_config', { key: ['ai_llm_voice_transcript_section', 'ai_llm_voice_transcript'] }, { transaction });
    })
};
