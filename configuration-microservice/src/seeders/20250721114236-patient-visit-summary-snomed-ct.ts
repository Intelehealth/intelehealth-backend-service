import { QueryInterface } from "sequelize";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert("mst_patient_visit_summary", [
        { name: "Diagnosis SnomedCT", is_enabled: true, platform: "Webapp" },
      ]);

      await queryInterface.bulkInsert('mst_webrtc', [
        { name: 'Audio Call', key: 'audio_call', is_enabled: true, platform: "Webapp" },
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete("mst_patient_visit_summary", {}, { transaction });
      await queryInterface.bulkDelete('mst_webrtc', {}, { transaction });
    }),
};
