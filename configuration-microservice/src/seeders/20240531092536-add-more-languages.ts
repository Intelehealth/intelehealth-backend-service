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
                { name: 'ಕನ್ನಡ', code: 'kn', en_name: 'Kannada', is_default: false },
                { name: 'मराठी', code: 'mr', en_name: 'Marathi', is_default: false },
                { name: 'অসমীয়া', code: 'as', en_name: 'Assamese', is_default: false },
                { name: 'বাংলা', code: 'bn', en_name: 'Bengali', is_default: false },
                { name: 'ଓଡ଼ିଆ', code: 'or', en_name: 'Oriya', is_default: false },
                { name: 'ગુજરાતી', code: 'gu', en_name: 'Gujarati', is_default: false }
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
