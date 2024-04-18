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
      await queryInterface.bulkInsert('mst_language', [
        { name: 'English', code: 'en', en_name: 'English', is_default: true, is_enabled: true },
        { name: 'हिंदी', code: 'hi', en_name: 'Hindi', is_default: false, is_enabled: true },
        { name: 'русский', code: 'ru', en_name: 'Russian', is_default: false, is_enabled: true }
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
      await queryInterface.bulkDelete('mst_language', {}, { transaction });
    })
};
