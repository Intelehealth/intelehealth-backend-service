import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */

const langArr = [
  { name: 'English', code: 'en', en_name: 'English', is_default: true },
  { name: 'हिंदी', code: 'hi', en_name: 'Hindi', is_default: false },
  { name: 'русский', code: 'ru', en_name: 'Russian', is_default: false },
  { name: 'ಕನ್ನಡ', code: 'kn', en_name: 'Kannada', is_default: false },
  { name: 'मराठी', code: 'mr', en_name: 'Marathi', is_default: false },
  { name: 'অসমীয়া', code: 'as', en_name: 'Assamese', is_default: false },
  { name: 'বাংলা', code: 'bn', en_name: 'Bengali', is_default: false },
  { name: 'ଓଡ଼ିଆ', code: 'or', en_name: 'Oriya', is_default: false },
  { name: 'ગુજરાતી', code: 'gu', en_name: 'Gujarati', is_default: false }
];

module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */
      try {
        await queryInterface.bulkUpdate('dic_config', {
          value: JSON.stringify(langArr),
        }, {
          key: 'language'
        });
      } catch (error) {
        console.log('error: ', error);
      }
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'language' }, { transaction });
    })
};
