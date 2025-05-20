import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_home_screen', [
        { name: "My Achievement", lang: JSON.stringify({ en: "My Achievement" }), key: 'my_achievement', is_editable: true, is_enabled: true, is_locked: false, label: '0' },
        { name: "Update Protocol", lang: JSON.stringify({ en: "Update Protocol" }), key: 'update_protocol', is_editable: true, is_enabled: true, is_locked: false, label: '0' },
      ], { transaction }).catch((error) => {
        if (error.name === 'SequelizeValidationError') {
          error.errors.forEach((err: any) => {
            console.error(`Field: ${err.path}, Message: ${err.message}`);
          });
        } else {
          console.error("An unexpected error occurred:", error);
        }
      });
    }
  ),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_home_screen', {}, { transaction });
    }
  )
};
