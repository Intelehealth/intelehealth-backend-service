import { QueryInterface } from "sequelize";

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        "mst_ai_llm_voice_transcript",
        [
          { key: "record_transcribe_webapp", name: "Record & transcribe calls (Doctor webapp)", is_enabled: false },
          { key: "record_transcribe_mobile", name: "Record & transcribe calls (Mobile)", is_enabled: false },
          { key: "feed_ai_ddx", name: "Feed transcript into AI DDx", is_enabled: false },
          { key: "autofill_doctor_notes", name: "Auto-populate summary in Doctor's notes", is_enabled: false },
        ],
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        "mst_ai_llm_voice_transcript",
        {
          key: ["record_transcribe_webapp", "record_transcribe_mobile", "feed_ai_ddx", "autofill_doctor_notes"],
        },
        { transaction }
      );
    }),
};
