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
          key: 'language',
          value: JSON.stringify([
            { name: 'English', code: 'en', is_default: true },
            { name: 'हिंदी', code: 'hi', is_default: false },
            { name: 'русский', code: 'ru', is_default: false }
          ]),
          type: 'array',
          default_value: JSON.stringify([
            { name: 'English', code: 'en', is_default: true },
            { name: 'हिंदी', code: 'hi', is_default: false },
            { name: 'русский', code: 'ru', is_default: false }
          ])
        }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'language' }, { transaction });
    })
};
