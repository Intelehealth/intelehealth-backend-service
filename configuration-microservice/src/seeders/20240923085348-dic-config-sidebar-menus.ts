import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async () => {
      /**
       * Add seed commands here.
      */
      const menus = {
        dashboard: true,
        messages: true,
        appointment: true,
        calendar: true,
        prescription: true,
        help_support: true,
        my_profile: true
      }
      await queryInterface.bulkInsert('dic_config', [
        {
          key: 'sidebar_menus',
          value: JSON.stringify(menus),
          type: 'array',
          default_value: JSON.stringify(menus)
        }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'sidebar_menus' }, { transaction });
    })
};
