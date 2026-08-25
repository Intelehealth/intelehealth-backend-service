import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        'dic_config',
        [
          {
            key: 'prescription_notes_section',
            value: true,
            type: 'boolean',
            default_value: true,
          },
        ],
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        'dic_config',
        { key: ['prescription_notes_section'] },
        { transaction }
      );
    }),
};
