import { QueryInterface} from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_patient_visit_summary', [
        { name: 'DP Call Status', is_enabled: false },
        { name: 'DP Dignosis Secondary', is_enabled: false },
        { name: 'DP Recommendation Group', is_enabled: false },
        { name: 'DP Medication Secondary', is_enabled: false },
        { name: 'DP Investigations Secondary', is_enabled: false },
        { name: 'DP Referral Secondary', is_enabled: false },
        { name: 'DP Discussion Summary', is_enabled: false }
      ]);
      await queryInterface.bulkUpdate('mst_patient_visit_sections', [
        {sub_sections: JSON.stringify([{"name": "HW", "is_enabled": true},{"name": "Patient", "is_enabled": true},{"name": "Comment", "is_enabled": true}])},
      ], {
        key: 'patient_interaction'
      });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_patient_visit_summary'
        , { name: [ 
              'DP Call Status',
              'DP Dignosis Secondary',
              'DP Recommendation Group',
              'DP Medication Secondary',
              'DP Investigations Secondary',
              'DP Referral Secondary',
              'DP Discussion Summary'
            ] }, { transaction });
      await queryInterface.bulkUpdate('mst_patient_visit_sections', [
        {sub_sections: JSON.stringify([{"name": "HW", "is_enabled": true},{"name": "Patient", "is_enabled": true}])},
      ], {
        key: 'patient_interaction'
      });
    })
};
