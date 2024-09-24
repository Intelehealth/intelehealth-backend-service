import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async () => {
      /**
       * Add seed commands here.
      */
      const menus = [
        { name: 'Dashboard', key: 'dashboard', is_enabled: true },
        { name: 'Messages', key: 'messages', is_enabled: true },
        { name: 'Appointment', key: 'appointment', is_enabled: true },
        { name: 'Calendar', key: 'calendar', is_enabled: true },
        { name: 'Prescription', key: 'prescription', is_enabled: true },
        { name: 'Help & Support', key: 'help_support', is_enabled: true }
      ];
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
