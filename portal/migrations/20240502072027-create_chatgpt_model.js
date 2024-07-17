'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("chatgptmodels", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      model: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true
      },
      isDefault: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      temprature: {
        type: Sequelize.FLOAT,
        defaultValue: 1,
        allowNull: false
      },
      top_p: {
          type: Sequelize.FLOAT,
          defaultValue: 1,
          allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('chatgptmodels');
  }
};
