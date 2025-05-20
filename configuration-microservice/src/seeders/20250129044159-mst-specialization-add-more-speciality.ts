import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkInsert('mst_specialization', [
        { name: "Surgical Oncologist - Urology", key: "surgical_oncologist_urology", is_enabled: false },
        { name: "Surgical Oncologist - Gastrointestinal", key: "surgical_oncologist_gastrointestinal", is_enabled: false },
        { name: "Surgical Oncologist - Breast", key: "surgical_oncologist_breast", is_enabled: false },
        { name: "Surgical Oncologist - Gynaecologist", key: "surgical_oncologist_gynaecologist", is_enabled: false },
        { name: "Surgical Oncologist - Bone and Soft Tissue", key: "surgical_oncologist_bone_and_soft_tissue", is_enabled: false },
        { name: "Medical Oncologist - Gastrointestinal", key: "medical_oncologist_gastrointestinal", is_enabled: false },
        { name: "Medical Oncologist - Breast", key: "medical_oncologist_breast", is_enabled: false },
        { name: "Medical Oncologist - Gynaecologist", key: "medical_oncologist_gynaecologist", is_enabled: false },
        { name: "Medical Oncologist - Bone and Soft Tissue", key: "medical_oncologist_bone_and_soft_tissue", is_enabled: false }
      ]);
    }),

  down: (queryInterface: QueryInterface): Promise<void> => queryInterface.sequelize.transaction(
    async (transaction) => {
      await queryInterface.bulkDelete('mst_specialization', {
        key: ['surgical_oncologist_urology',
          'surgical_oncologist_gastrointestinal',
          'surgical_oncologist_breast',
          'surgical_oncologist_gynaecologist',
          'surgical_oncologist_bone_and_soft_tissue',
          'medical_oncologist_gastrointestinal',
          'medical_oncologist_breast',
          'medical_oncologist_gynaecologist',
          'medical_oncologist_bone_and_soft_tissue']
      }, { transaction });
    })
};
