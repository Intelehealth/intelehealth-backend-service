import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
      */
      await queryInterface.bulkInsert('dic_config', [
        {
          key: 'theme_config',
          value: JSON.stringify([
            { key: 'logo', value: 'assets/images/default-logo.png'},
            { key: 'thumbnail_logo', value: 'assets/images/default-thumbnail.png'},
            { key: 'primary_color', value:'#2E1E91'},
            { key: 'secondory_color', value:'#2E1E91'},
            { key: 'images_with_text', value: [
              {image: 'assets/images/slides/default-slide-1.svg', text:'Deliver quality health care where there is no doctor'},
              {image: 'assets/images/slides/default-slide-2.svg', text:'2,75,000 population covered from 215 villages in 2 countries'},
              {image: 'assets/images/slides/default-slide-3.svg', text:'Take online consultations and send prescriptions to the patients virtually'}
            ]},
          ]),
          type: 'array',
          default_value: JSON.stringify([
            { key: 'logo', value: 'assets/images/default-logo.png'},
            { key: 'thumbnail_logo', value: 'assets/images/default-thumbnail.png'},
            { key: 'primary_color', value:'#2E1E91'},
            { key: 'secondory_color', value:'#2E1E91'},
            { key: 'images_with_text', value: [
              {image: 'assets/images/slides/default-slide-1.svg', text:'Deliver quality health care where there is no doctor'},
              {image: 'assets/images/slides/default-slide-2.svg', text:'2,75,000 population covered from 215 villages in 2 countries'},
              {image: 'assets/images/slides/default-slide-3.svg', text:'Take online consultations and send prescriptions to the patients virtually'}
            ]},
          ])
        }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'language' }, { transaction });
    })
};
