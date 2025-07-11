import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */

      const config:any[] = [];
      await queryInterface.bulkInsert('theme_config', [
        { key: 'help_tour_config', default_value: JSON.stringify(config), value: JSON.stringify(config)},
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('theme_config', { key: 'help_tour_config' }, { transaction });
    })
};
