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
        { name: 'Profile Photo', key: 'p_profile_photo', section: 'Personal', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'First Name', key: 'p_first_name', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: true },
        { name: 'Middle Name', key: 'p_middle_name', section: 'Personal', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Last Name', key: 'p_last_name', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: true },
        { name: 'Gender', key: 'p_gender', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Date of Birth', key: 'p_date_of_birth', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: true },
        { name: 'Age', key: 'p_age', section: 'Personal', is_mandatory: true, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Phone Number', key: 'p_phone_number', section: 'Personal', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: true },
        
        { name: 'Postal Code', key: 'a_postal_address', section: 'Address', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
        { name: 'Country', key: 'a_country', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: true },
        { name: 'State', key: 'a_state', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'District', key: 'a_district', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Village/Town/City', key: 'a_village_town_city', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Corresponding Address 1', key: 'a_corresponding_address_1', section: 'Address', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: true },
        { name: 'Corresponding Address 2', key: 'a_corresponding_address_2', section: 'Address', is_mandatory: false, is_editable: true, is_enabled: true, is_locked: false },

        { name: 'National ID', key: 'o_national_id', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Occupation', key: 'o_occupation', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Social Category', key: 'o_social_category', section: 'Other', is_mandatory: false, is_editable: true, is_enabled: true, is_locked: false },
        { name: 'Education', key: 'o_education', section: 'Other', is_mandatory: true, is_editable: true, is_enabled: true, is_locked: true },
        { name: 'Economic Category', key: 'o_economic_category', section: 'Other', is_mandatory: false, is_editable: false, is_enabled: true, is_locked: false },
		
		    { name: 'Guardian Type', key: 'p_guardian_type', section: 'Personal', is_mandatory: false, is_editable: true, is_enabled: false, is_locked: false },
        { name: 'Guardian Name', key: 'p_guardian_name', section: 'Personal', is_mandatory: false, is_editable: true, is_enabled: false, is_locked: false },
        { name: 'Emergency Contact Name', key: 'p_emergency_contact_name', section: 'Personal', is_mandatory: false, is_editable: true, is_enabled: false, is_locked: false },
        { name: 'Emergency Contact Number', key: 'p_emergency_contact_number', section: 'Personal', is_mandatory: true, is_editable: true, is_enabled: false, is_locked: false },
        { name: 'Emergency Contact Type', key: 'p_emergency_contact_type', section: 'Personal', is_mandatory: false, is_editable: true, is_enabled: false, is_locked: false },
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
