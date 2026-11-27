'use strict';

// Adds one column to the existing turn_call_links table: when the patient
// first clicked "Join Consultation" in the WhatsApp message.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('turn_call_links', 'joinClickedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('turn_call_links', 'joinClickedAt');
  },
};
