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
            { name: 'Height (cm)', key: 'height_cm', uuid: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'Weight (kg)', key: 'weight_kg', uuid: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'BMI', key: 'bmi', uuid: '9d311fac-538f-11e6-9cfe-86f436325720', is_mandatory: true },
            { name: 'BP Systolic', key: 'bp_systolic', uuid: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'BP Diastolic', key: 'bp_diastolic', uuid: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'Pulse (bpm)', key: 'pulse_bpm', uuid: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'Temprature (F)', key: 'temprature_f', uuid: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'SpO2 (%)', key: 'spo2', uuid: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'Respiratory Rate', key: 'respiratory_rate', uuid: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
          ]),
          type: 'array',
          default_value: JSON.stringify([
            { name: 'Height (cm)', key: 'height_cm', uuid: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'Weight (kg)', key: 'weight_kg', uuid: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'BMI', key: 'bmi', uuid: '9d311fac-538f-11e6-9cfe-86f436325720', is_mandatory: true },
            { name: 'BP Systolic', key: 'bp_systolic', uuid: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'BP Diastolic', key: 'bp_diastolic', uuid: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'Pulse (bpm)', key: 'pulse_bpm', uuid: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'Temprature (F)', key: 'temprature_f', uuid: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'SpO2 (%)', key: 'spo2', uuid: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
            { name: 'Respiratory Rate', key: 'respiratory_rate', uuid: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', is_mandatory: true },
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
