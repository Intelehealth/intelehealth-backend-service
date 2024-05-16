import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */
      await queryInterface.bulkInsert('theme_config', [
        { key: 'logo', default_value: 'assets/images/default-logo.png'},
        { key: 'thumbnail_logo', default_value: 'assets/images/default-thumbnail.png'},
        { key: 'primary_color', default_value:'#2E1E91'},
        { key: 'secondory_color', default_value:'#2E1E91'},
        { key: 'images_with_text', default_value: JSON.stringify([
          {image: 'assets/images/slide-1.svg', text:'Deliver quality health care where there is no doctor'},
          {image: 'assets/images/slide-2.svg', text:'2,75,000 population covered from 215 villages in 2 countries'},
          {image: 'assets/images/slide-3.svg', text:'Take online consultations and send prescriptions to the patients virtually'}
        ])},
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('theme_config', { key: 'language' }, { transaction });
    })
};
