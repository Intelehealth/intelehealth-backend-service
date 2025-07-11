import { QueryInterface } from 'sequelize';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
    up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
        async (transaction) => {
            await queryInterface.bulkInsert('mst_features', [
                { key: 'patient_family_member_registration', name: 'Patient Family Member Registration', is_enabled: true },
                { key: 'patient_household_survey', name: 'Patient Household Survey', is_enabled: true }
            ], { transaction });
        }),

    down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
        async (transaction) => {
            await queryInterface.bulkDelete('mst_features', {
                key: ['patient_family_member_registration', 'patient_household_survey']
            }, { transaction });
        })
};
