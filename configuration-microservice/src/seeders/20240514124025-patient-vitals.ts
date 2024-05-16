import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
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
      await queryInterface.bulkInsert('mst_patient_vital', [
        { name: 'Height', key: 'height', is_enabled: true, is_mandatory: true },
        { name: 'Weight', key: 'weight', is_enabled: true, is_mandatory: true },
        { name: 'BMI', key: 'bmi', is_enabled: true, is_mandatory: true },
        { name: 'BP Systolic', key: 'bp_systolic', is_enabled: true, is_mandatory: true },
        { name: 'BP Diastolic', key: 'bp_diastolic', is_enabled: true, is_mandatory: true },
        { name: 'Pulse (bpm)', key: 'pulse_bpm', is_enabled: true, is_mandatory: true },
        { name: 'Temprature', key: 'temprature', is_enabled: true, is_mandatory: true },
        { name: 'SpO2 (%)', key: 'spo2', is_enabled: true, is_mandatory: true },
        { name: 'Respiratory Rate', key: 'respiratory_rate', is_enabled: true, is_mandatory: true },
        { name: 'FBS & PPBS (mg/dl)', key: 'fbs_and_ppbs_mg_per_dl', is_enabled: false, is_mandatory: false },
        { name: 'RBS (mg/dl)', key: 'rbs_mg_per_dl', is_enabled: false, is_mandatory: false },
        { name: 'Waist Circumference (cm)', key: 'waist_circumference_cm', is_enabled: false, is_mandatory: true },
        { name: 'Hip Circumference (cm)', key: 'hip_circumference_cm', is_enabled: false, is_mandatory: true },
        { name: 'Waist to Hip Ratio (WHR)', key: 'waist_to_hip_ratio', is_enabled: false, is_mandatory: true },
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       *
       * Example:
       * await queryInterface.bulkDelete('People', null, {});
       */
      await queryInterface.bulkDelete('mst_patient_vital', {}, { transaction });
    })
};
