import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add seed commands here.
       *
       * Example:
       * await queryInterface.bulkInsert('People', [{
       *   name: 'John Doe',
       *   isBetaMember: false
       * }], {});
      */
      await queryInterface.bulkInsert('mst_patient_registration', [
        { name: 'Profile Photo', section: 'Personal', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'First Name', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: true },
        { name: 'Middle Name', section: 'Personal', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Last Name', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: true },
        { name: 'Gender', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Date of Birth', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: true },
        { name: 'Age', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Phone Number', section: 'Personal', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: true },
        
        { name: 'Postal Code', section: 'Address', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Country', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: true },
        { name: 'State', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'District', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Village/Town/City', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Corresponding Address 1', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: true },
        { name: 'Corresponding Address 2', section: 'Address', is_mandatory: false, is_editable: true, is_enabled: true, is_locked: false },

        { name: 'National ID', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Occupation', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Social Category', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Education', section: 'Other', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: true },
        { name: 'Economic Category', section: 'Other', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
		
		{ name: 'Guardian Type', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: false, is_locked: false },
        { name: 'Guardian Name', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: false, is_locked: false },
        { name: 'Emergency Contact Name', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: false, is_locked: false },
        { name: 'Emergency Contact Number', section: 'Other', is_mandatory: true, is_editable: true, is_enabled: false, is_locked: false },
        { name: 'Emergency Contact Type', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: false, is_locked: false },
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       *
       * Example:
       * await queryInterface.bulkDelete('People', null, {});
       */
      await queryInterface.bulkDelete('mst_patient_registration', {}, { transaction });
    })
};
