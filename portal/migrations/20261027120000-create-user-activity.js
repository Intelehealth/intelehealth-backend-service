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
      // The time already counted for that day, as sorted intervals of seconds since IST midnight:
      // "32400-43200,43500-43800". Overlapping or touching time is one interval, so the same minutes
      // reported twice (two tabs, two devices), or in any order, are counted once. active_seconds is
      // the total length of these intervals.
      covered_intervals: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      // CRC32 of the ids of the last 20 heartbeat requests that had one, comma separated, oldest first, so
      // the same request sent again adds nothing even when another device sent a request in between.
      // Empty until a request with an id has been recorded.
      recent_request_crcs: {
        allowNull: false,
        type: Sequelize.TEXT
      }
    });
    // The heartbeat creates the day's row with INSERT ... ON DUPLICATE KEY UPDATE, which relies on this key,
    // then locks it (SELECT ... FOR UPDATE) while it adds the new interval.
    // The same key serves the summary: one day of one worker, or a range of days of one worker.
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_activity');
  }
};
