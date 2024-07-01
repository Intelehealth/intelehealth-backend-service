import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
       *
       * Example:
       * await queryInterface.bulkInsert('People', [{
       *   name: 'John Doe',
       *   isBetaMember: false
       * }], {});
      */
      await queryInterface.bulkInsert('mst_features', [
        { key: 'webrtc_section', name: 'WebRTC', is_enabled: true },
        { key: 'patient_vitals_section', name: 'Patient Vitals',  is_enabled: true },
        { key: 'abha_section', name: 'ABHA ID', is_enabled: true },
        { key: 'patient_reg_address', name: 'Patient Reg Address', is_enabled: true },
        { key: 'patient_reg_other', name: 'Patient Reg Other', is_enabled: true }
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       *
       * Example:
       * await queryInterface.bulkDelete('People', null, {});
       */
      await queryInterface.bulkDelete('mst_features', {}, { transaction });
    })
};
