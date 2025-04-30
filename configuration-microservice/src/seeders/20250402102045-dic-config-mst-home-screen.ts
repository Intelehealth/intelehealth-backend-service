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
          key: 'home_screen',
          value: JSON.stringify([
            { name: "My Achievement", lang: JSON.stringify({ en: "My Achievement" }), key: 'my_achievement', is_editable: true, is_enabled: true, is_locked: false, label: '0' },
            { name: "Update Protocol", lang: JSON.stringify({ en: "Update Protocol" }), key: 'update_protocol', is_editable: true, is_enabled: true, is_locked: false, label: '0' },
          ]),
          type: 'array',
          default_value: JSON.stringify([
            { name: "My Achievement", lang: JSON.stringify({ en: "My Achievement" }), key: 'my_achievement', is_editable: true, is_enabled: true, is_locked: false, label: '0' },
            { name: "Update Protocol", lang: JSON.stringify({ en: "Update Protocol" }), key: 'update_protocol', is_editable: true, is_enabled: true, is_locked: false, label: '0' },
          ])
        }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'home_screen' }, { transaction });
    })
};
