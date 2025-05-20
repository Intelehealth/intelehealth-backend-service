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
        { lang: JSON.stringify({ en: "Height (cm)" }), name: 'Height (cm)', key: 'height_cm', uuid:'5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_enabled: true, is_mandatory: true },
        { lang: JSON.stringify({ en: "Weight (kg)" }), name: 'Weight (kg)', key: 'weight_kg', uuid:'5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_enabled: true, is_mandatory: true },
        { lang: JSON.stringify({ en: "BMI" }), name: 'BMI', key: 'bmi', uuid:'9d311fac-538f-11e6-9cfe-86f436325720', is_enabled: true, is_mandatory: true },
        { lang: JSON.stringify({ en: "BP Systolic" }), name: 'BP Systolic', key: 'bp_systolic', uuid:'5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_enabled: true, is_mandatory: true },
        { lang: JSON.stringify({ en: "BP Diastolic" }), name: 'BP Diastolic', key: 'bp_diastolic', uuid:'5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_enabled: true, is_mandatory: true },
        { lang: JSON.stringify({ en: "Pulse (bpm)" }), name: 'Pulse (bpm)', key: 'pulse_bpm', uuid:'5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_enabled: true, is_mandatory: true },
        { lang: JSON.stringify({ en: "Temprature (F)" }), name: 'Temprature (F)', key: 'temprature_f', uuid:'5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_enabled: true, is_mandatory: true },
        { lang: JSON.stringify({ en: "SpO2 (%)" }), name: 'SpO2 (%)', key: 'spo2', uuid:'5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_enabled: true, is_mandatory: true },
        { lang: JSON.stringify({ en: "Respiratory Rate" }), name: 'Respiratory Rate', key: 'respiratory_rate', uuid:'5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_enabled: true, is_mandatory: true },
        { lang: JSON.stringify({ en: "FBS (mg/dl)" }), name: 'FBS (mg/dl)', key: 'fbs_mg_per_dl', uuid:'2d6845e6-fa7a-4a80-a55a-c4fa6ff4e2af', is_enabled: false, is_mandatory: false },
        { lang: JSON.stringify({ en: "PPBS (mg/dl)" }), name: 'PPBS (mg/dl)', key: 'ppbs_mg_per_dl', uuid:'e2d331f0-3132-4b66-9137-b1f9ace65443', is_enabled: false, is_mandatory: false },
        { lang: JSON.stringify({ en: "RBS (mg/dl)" }), name: 'RBS (mg/dl)', key: 'rbs_mg_per_dl', uuid:'056f3911-55ee-42c4-8078-5537a620a35a', is_enabled: false, is_mandatory: false },
        { lang: JSON.stringify({ en: "Waist Circumference (cm)" }), name: 'Waist Circumference (cm)', key: 'waist_circumference_cm', uuid:'41e7d3ff-d24b-448f-a248-a4feb64ef700', is_enabled: false, is_mandatory: true },
        { lang: JSON.stringify({ en: "Hip Circumference (cm)" }), name: 'Hip Circumference (cm)', key: 'hip_circumference_cm', uuid:'9f1b264f-2b9b-44f5-9d7a-c809e9f63c51', is_enabled: false, is_mandatory: true },
        { lang: JSON.stringify({ en: "Waist to Hip Ratio (WHR)" }), name: 'Waist to Hip Ratio (WHR)', key: 'waist_to_hip_ratio', uuid:'20d3e924-f379-443d-9033-c8d1cdfda2f0', is_enabled: false, is_mandatory: true },
        { lang: JSON.stringify({ en: "2 Hour Post Load Glucose Test (OGTT) (mg/dl)" }), name: '2 Hour Post Load Glucose Test (OGTT) (mg/dl)', key: 'ogtt_mg_per_dl', uuid:'d7a564d7-f104-4186-8e36-68101c7c2952', is_enabled: false, is_mandatory: false },
        { lang: JSON.stringify({ en: "HbA1c" }), name: 'HbA1c', key: 'hba1c', uuid:'f0631271-e0b3-48ca-a4e5-70959a7b76d9', is_enabled: false, is_mandatory: false },
        { lang: JSON.stringify({ en: "Blood Group" }), name: 'Blood Group', key: 'blood_group', uuid:'9d2df0c6-538f-11e6-9cfe-86f436325720', is_enabled: false, is_mandatory: false },
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
