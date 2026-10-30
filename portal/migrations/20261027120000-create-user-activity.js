'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // One row per health worker per IST day, holding only what the Achievements panel and the
    // heartbeat need. The two key columns are the primary key: there is no separate id and no second
    // (unique) index, so each row is stored once.
    await queryInterface.createTable('user_activity', {
      provider_uuid: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING(36)
      },
      activity_date: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.DATEONLY
      },
      active_seconds: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      // The end of the latest period of time already counted for that day. The heartbeat adds only
      // time after it, so the same minutes reported twice (two tabs, two devices) are added once.
      covered_until: {
        allowNull: false,
        type: Sequelize.DATE
      },
      // CRC32 of the id of the last heartbeat request that had one, so the same request sent again
      // adds nothing. Null until a request with an id has been recorded.
      last_request_crc: {
        allowNull: true,
        type: Sequelize.INTEGER.UNSIGNED
      }
    });
    // The heartbeat adds to the row with INSERT ... ON DUPLICATE KEY UPDATE, which relies on this key.
    // The same key serves the summary: one day of one worker, or a range of days of one worker.
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_activity');
  }
};
