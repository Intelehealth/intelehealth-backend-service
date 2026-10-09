import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_specialization', [
        { name: 'Gynaecologist', key: 'gynaecologist', is_enabled: true },
        { name: 'Orthopaedic', key: 'orthopaedic', is_enabled: true },
        { name: 'Dermatologist', key: 'dermatologist', is_enabled: true },
      ], { transaction });
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_specialization', {
        key: ['gynaecologist', 'orthopaedic', 'dermatologist'],
      }, { transaction });
    })
};
