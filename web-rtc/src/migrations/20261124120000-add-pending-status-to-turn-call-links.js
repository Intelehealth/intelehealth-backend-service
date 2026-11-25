'use strict';

// 'pending': row created when the patient clicked "Join Consultation" before
// the reminder job sent its link. The job still claims and sends these.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('turn_call_links', 'status', {
      type: Sequelize.ENUM('pending', 'sending', 'sent', 'failed'),
      allowNull: false,
      defaultValue: 'sending',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `UPDATE turn_call_links SET status = 'failed' WHERE status = 'pending'`
    );
    await queryInterface.changeColumn('turn_call_links', 'status', {
      type: Sequelize.ENUM('sending', 'sent', 'failed'),
      allowNull: false,
      defaultValue: 'sending',
    });
  },
};
