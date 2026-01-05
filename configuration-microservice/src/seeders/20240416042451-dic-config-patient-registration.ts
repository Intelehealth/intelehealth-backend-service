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
          key: 'patient_registration',
          value: JSON.stringify({
            personal: [
              { name: 'Profile Photo', key: 'p_profile_photo', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'First Name', key: 'p_first_name', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Middle Name', key: 'p_middle_name', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Last Name', key: 'p_last_name', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Gender', key: 'p_gender', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Date of Birth', key: 'p_date_of_birth', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Age', key: 'p_age', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Phone Number', key: 'p_phone_number', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Guardian Type', key: 'p_guardian_type', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Guardian Name', key: 'p_guardian_name', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Name', key: 'p_emergency_contact_name', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Number', key: 'p_emergency_contact_number', is_mandatory: true, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Type', key: 'p_emergency_contact_type', is_mandatory: false, is_editable: true, is_enabled: false }
            ],
            address: [
              { name: 'Postal Code', key: 'a_postal_address', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Country', key: 'a_country', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'State', key: 'a_state', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'District', key: 'a_district', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Village/Town/City', key: 'a_village_town_city', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Corresponding Address 1', key: 'a_corresponding_address_1', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Corresponding Address 2', key: 'a_corresponding_address_2', is_mandatory: false, is_editable: true, is_enabled: true }
            ],
            other: [
              { name: 'National ID', key: 'o_national_id', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Occupation', key: 'o_occupation', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Social Category', key: 'o_social_category', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Education', key: 'o_education', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Economic Category', key: 'o_economic_category', is_mandatory: false, is_editable: false, is_enabled: true }
            ]
          }),
          type: 'array',
          default_value: JSON.stringify({
            personal: [
              { name: 'Profile Photo', key: 'p_profile_photo', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'First Name', key: 'p_first_name', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Middle Name', key: 'p_middle_name', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Last Name', key: 'p_last_name', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Gender', key: 'p_gender', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Date of Birth', key: 'p_date_of_birth', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Age', key: 'p_age', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Phone Number', key: 'p_phone_number', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Guardian Type', key: 'p_guardian_type', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Guardian Name', key: 'p_guardian_name', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Name', key: 'p_emergency_contact_name', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Number', key: 'p_emergency_contact_number', is_mandatory: true, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Type', key: 'p_emergency_contact_type', is_mandatory: false, is_editable: true, is_enabled: false }
            ],
            address: [
              { name: 'Postal Code', key: 'a_postal_address', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Country', key: 'a_country', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'State', key: 'a_state', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'District', key: 'a_district', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Village/Town/City', key: 'a_village_town_city', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Corresponding Address 1', key: 'a_corresponding_address_1', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Corresponding Address 2', key: 'a_corresponding_address_2', is_mandatory: false, is_editable: true, is_enabled: true }
            ],
            other: [
              { name: 'National ID', key: 'o_national_id', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Occupation', key: 'o_occupation', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Social Category', key: 'o_social_category', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Education', key: 'o_education', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Economic Category', key: 'o_economic_category', is_mandatory: false, is_editable: false, is_enabled: true }
            ]
          })
        }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      /**
       * Add commands to revert seed here.
       */
      await queryInterface.bulkDelete('dic_config', { key: 'patient_registration' }, { transaction });
    })
};
