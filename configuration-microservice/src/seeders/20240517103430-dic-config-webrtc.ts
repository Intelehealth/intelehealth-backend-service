import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */
      await queryInterface.bulkInsert('dic_config', [
        {
          key: 'webrtc',
          value: JSON.stringify(
            { webrtc: true, chat: true, video_call: true, audio_call: true },
          ),
          type: 'json',
          default_value: JSON.stringify({ webrtc: true, chat: true, video_call: true, audio_call: true })
        }
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'webrtc' }, { transaction });
    })
};
