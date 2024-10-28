import { QueryInterface } from 'sequelize';

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
      await queryInterface.bulkInsert('mst_sidebar_menu', [
        { name: 'Dashboard', key: 'dashboard', is_enabled: true, is_locked: true },
        { name: 'Messages', key: 'messages', is_enabled: true, is_locked: false  },
        { name: 'Appointment', key: 'appointment', is_enabled: true, is_locked: false  },
        { name: 'Calendar', key: 'calendar', is_enabled: true, is_locked: false  },
        { name: 'Prescription', key: 'prescription', is_enabled: true, is_locked: false  },
        { name: 'Help & Support', key: 'help_support', is_enabled: true, is_locked: false },
        { name: 'My Profile', key: 'my_profile', is_enabled: true, is_locked: true  }
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
      await queryInterface.bulkDelete('mst_sidebar_menu', {}, { transaction });
    })
};
