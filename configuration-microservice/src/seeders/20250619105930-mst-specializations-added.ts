import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_specialization', [
        { name: "Surgical Gastrointestinal", key: "surgical_gastrointestinal", is_enabled: false},
        { name: "Pediatric Solid Tumor", key: "pediatric_solid_tumor", is_enabled: false },
        { name: "Head and Neck Surgical Oncology", key: "head_and_neck_surgical_oncology", is_enabled: false },
        { name: "Radiation Oncology", key: "radiation_oncology", is_enabled: false },
        { name: "Bone and Soft Tissue Medical Oncology", key: "bone_and_soft_tissue_medical_oncology", is_enabled: false },
        { name: "Surgical Breast Oncology", key: "surgical_breast_oncology", is_enabled: false },
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_specialization', {
        key: ['surgical_gastrointestinal',
          'pediatric_solid_tumor',
          'head_and_neck_surgical_oncology',
          'radiation_oncology',
          'bone_and_soft_tissue_medical_oncology',
          'surgical_breast_oncology']
      }, { transaction });
    })
};
