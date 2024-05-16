import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */
      await queryInterface.bulkInsert('dic_config', [
        {
          key: 'patient_vitals',
          value: JSON.stringify([
            { name: 'Height', key: 'height', is_mandatory: true },
            { name: 'Weight', key: 'weight', is_mandatory: true },
            { name: 'BMI', key: 'bmi', is_mandatory: true },
            { name: 'BP Systolic', key: 'bp_systolic', is_mandatory: true },
            { name: 'BP Diastolic', key: 'bp_diastolic', is_mandatory: true },
            { name: 'Pulse (bpm)', key: 'pulse_bpm', is_mandatory: true },
            { name: 'Temprature', key: 'temprature', is_mandatory: true },
            { name: 'SpO2 (%)', key: 'spo2', is_mandatory: true },
            { name: 'Respiratory Rate', key: 'respiratory_rate', is_mandatory: true },
          ]),
          type: 'array',
          default_value: JSON.stringify([
            { name: 'Height', key: 'height', is_mandatory: true },
            { name: 'Weight', key: 'weight', is_mandatory: true },
            { name: 'BMI', key: 'bmi', is_mandatory: true },
            { name: 'BP Systolic', key: 'bp_systolic', is_mandatory: true },
            { name: 'BP Diastolic', key: 'bp_diastolic', is_mandatory: true },
            { name: 'Pulse (bpm)', key: 'pulse_bpm', is_mandatory: true },
            { name: 'Temprature', key: 'temprature', is_mandatory: true },
            { name: 'SpO2 (%)', key: 'spo2', is_mandatory: true },
            { name: 'Respiratory Rate', key: 'respiratory_rate', is_mandatory: true },
          ])
        }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'patient_vitals' }, { transaction });
    })
};
