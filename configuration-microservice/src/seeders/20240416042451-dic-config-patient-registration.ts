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
              { name: 'Profile Photo', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'First Name', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Middle Name', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Last Name', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Gender', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Date of Birth', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Age', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Phone Number', is_mandatory: true, is_editable: true, is_enabled: true }
            ],
            address: [
              { name: 'Postal Code', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Country', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'State', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'District', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Village/Town/City', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Corresponding Address 1', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Corresponding Address 2', is_mandatory: false, is_editable: true, is_enabled: true }
            ],
            other: [
              { name: 'National ID', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Occupation', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Social Category', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Education', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Economic Category', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Guardian Type', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Guardian Name', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Name', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Number', is_mandatory: true, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Type', is_mandatory: false, is_editable: true, is_enabled: false }
            ]
          }),
          type: 'array',
          default_value: JSON.stringify({
            personal: [
              { name: 'Profile Photo', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'First Name', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Middle Name', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Last Name', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Gender', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Date of Birth', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Age', is_mandatory: true, is_editable: false, is_enabled: true },
              { name: 'Phone Number', is_mandatory: true, is_editable: true, is_enabled: true }
            ],
            address: [
              { name: 'Postal Code', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Country', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'State', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'District', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Village/Town/City', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Corresponding Address 1', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Corresponding Address 2', is_mandatory: false, is_editable: true, is_enabled: true }
            ],
            other: [
              { name: 'National ID', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Occupation', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Social Category', is_mandatory: false, is_editable: true, is_enabled: true },
              { name: 'Education', is_mandatory: true, is_editable: true, is_enabled: true },
              { name: 'Economic Category', is_mandatory: false, is_editable: false, is_enabled: true },
              { name: 'Guardian Type', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Guardian Name', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Name', is_mandatory: false, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Number', is_mandatory: true, is_editable: true, is_enabled: false },
              { name: 'Emergency Contact Type', is_mandatory: false, is_editable: true, is_enabled: false }
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
