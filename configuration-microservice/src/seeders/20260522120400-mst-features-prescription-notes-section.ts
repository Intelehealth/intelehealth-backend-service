import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        'mst_features',
        [
          {
            key: 'prescription_notes_section',
            name: 'Prescription Notes',
            is_enabled: true,
            platform: 'Both',
          },
        ],
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        'mst_features',
        { key: ['prescription_notes_section'] },
        { transaction }
      );
    }),
};
