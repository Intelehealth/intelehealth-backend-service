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
          key: 'specialization',
          value: JSON.stringify([
            { name: 'General Physician', key: 'general_physician' },
            { name: 'Pediatrician', key: 'pediatrician' },
            { name: 'Dermatologist or Skin Specialist', key: 'dermatologist_or_skin_specialist' },
            { name: 'OBGyn Specialist or Gynecologist', key: 'obgyn_specialist_or_gynecologist' },
            { name: 'Psychiatrist', key: 'psychiatrist' },
            { name: 'Neurologist', key: 'neurologist' },
            { name: 'Endocrinologist', key: 'endocrinologist' },
            { name: 'Cardiologist', key: 'cardiologist' },
            { name: 'Respiratory Medicine', key: 'respiratory_medicine' }
          ]),
          type: 'array',
          default_value: JSON.stringify([
            { name: 'General Physician', key: 'general_physician' },
            { name: 'Pediatrician', key: 'pediatrician' },
            { name: 'Dermatologist or Skin Specialist', key: 'dermatologist_or_skin_specialist' },
            { name: 'OBGyn Specialist or Gynecologist', key: 'obgyn_specialist_or_gynecologist' },
            { name: 'Psychiatrist', key: 'psychiatrist' },
            { name: 'Neurologist', key: 'neurologist' },
            { name: 'Endocrinologist', key: 'endocrinologist' },
            { name: 'Cardiologist', key: 'cardiologist' },
            { name: 'Respiratory Medicine', key: 'respiratory_medicine' }
          ])
        }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'specialization' }, { transaction });
    })
};
