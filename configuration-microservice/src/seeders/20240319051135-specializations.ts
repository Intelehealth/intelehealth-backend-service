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
      await queryInterface.bulkInsert('mst_specialization', [
        { name: 'General Physician', key: 'general_physician', is_enabled: true },
        { name: 'Pediatrician', key: 'pediatrician', is_enabled: true },
        { name: 'Dermatologist or Skin Specialist', key: 'dermatologist_or_skin_specialist', is_enabled: true },
        { name: 'OBGyn Specialist or Gynecologist', key: 'obgyn_specialist_or_gynecologist', is_enabled: true },
        { name: 'Psychiatrist', key: 'psychiatrist', is_enabled: true },
        { name: 'Neurologist', key: 'neurologist', is_enabled: true },
        { name: 'Endocrinologist', key: 'endocrinologist', is_enabled: true },
        { name: 'Cardiologist', key: 'cardiologist', is_enabled: true },
        { name: 'Respiratory Medicine', key: 'respiratory_medicine', is_enabled: true },
        { name: 'ENT Specialist', key: 'ent_specialist', is_enabled: false },
        { name: 'Ophthalmologist or Eye Specialist', key: 'ophthalmologist_or_eye_specialist', is_enabled: false },
        { name: 'Orthopedician', key: 'orthopedician', is_enabled: false },
        { name: 'Pulmonologist or Chest Physician/Specialist ', key: 'pulmonologist_or_chest_physician/specialist_', is_enabled: false },
        { name: 'Clinical Immunologist', key: 'clinical_immunologist', is_enabled: false },
        { name: 'Family Physician or Family Medicine Specialist', key: 'family_physician_or_family_medicine_specialist', is_enabled: false },
        { name: 'Geriatrician or Geriatrist', key: 'geriatrician_or_geriatrist', is_enabled: false },
        { name: 'General Surgeon', key: 'general_surgeon', is_enabled: false },
        { name: 'Rheumatologist', key: 'rheumatologist', is_enabled: false },
        { name: 'Pediatric Hepatologist', key: 'pediatric_hepatologist', is_enabled: false },
        { name: 'Pediatric Oncologist', key: 'pediatric_oncologist', is_enabled: false },
        { name: 'Pediatric Cardiologist', key: 'pediatric_cardiologist', is_enabled: false },
        { name: 'Pediatric Neurologist', key: 'pediatric_neurologist', is_enabled: false },
        { name: 'Neurosurgeon', key: 'neurosurgeon', is_enabled: false },
        { name: 'Urologist', key: 'urologist', is_enabled: false },
        { name: 'Nephrologist', key: 'nephrologist', is_enabled: false },
        { name: 'Medical Oncologist', key: 'medical_oncologist', is_enabled: false },
        { name: 'Oncosurgeron', key: 'oncosurgeron', is_enabled: false },
        { name: 'Tropical Medicine Specialist', key: 'tropical_medicine_specialist', is_enabled: false },
        { name: 'Infectious Diseases Specialist', key: 'infectious_diseases_specialist', is_enabled: false },
        { name: 'Sports Physician', key: 'sports_physician', is_enabled: false },
        { name: 'Clinical Geneticist', key: 'clinical_geneticist', is_enabled: false },
        { name: 'Geriatric Psychiatrist', key: 'geriatric_psychiatrist', is_enabled: false },
        { name: 'Pediatric Nephrologist', key: 'pediatric_nephrologist', is_enabled: false },
        { name: 'Neonatologist', key: 'neonatologist', is_enabled: false },
        { name: 'Gynecological Oncologist', key: 'gynecological_oncologist', is_enabled: false },
        { name: 'Hand Surgeon', key: 'hand_surgeon', is_enabled: false },
        { name: 'Hepato Pancreato Biliary Surgeon', key: 'hepato_pancreato_biliary_surgeon', is_enabled: false },
        { name: 'Reproductive endocrinologist or Infertility Specialist', key: 'reproductive_endocrinologist_or_infertility_specialist', is_enabled: false },
        { name: 'Vascular Surgeon', key: 'vascular_surgeon', is_enabled: false },
        { name: 'Surgical Gastroenterologist', key: 'surgical_gastroenterologist', is_enabled: false },
        { name: 'Medical Gastroenterologist', key: 'medical_gastroenterologist', is_enabled: false },
        { name: 'Cardiothoracic surgeon', key: 'cardiothoracic_surgeon', is_enabled: false },
        { name: 'Pediatric Surgeon', key: 'pediatric_surgeon', is_enabled: false },
        { name: 'Plastic Surgeon', key: 'plastic_surgeon', is_enabled: false },
        { name: 'Hematologist or Clinical Hematologist', key: 'hematologist_or_clinical_hematologist', is_enabled: false },
        { name: 'Child & Adolescent Psychiatrist', key: 'child_&_adolescent_psychiatrist', is_enabled: false },
        { name: 'Pediatric Gastroenterologist', key: 'pediatric_gastroenterologist', is_enabled: false },
        { name: 'Emergency Physician or Emergency Medicine Specialist', key: 'emergency_physician_or_emergency_medicine_specialist', is_enabled: false },
        { name: 'Hepatologist', key: 'hepatologist', is_enabled: false },
        { name: 'Head & Neck Surgeon', key: 'head_&_neck_surgeon', is_enabled: false },
        { name: 'Pediatric Orthopedician', key: 'pediatric_orthopedician', is_enabled: false }
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
      await queryInterface.bulkDelete('mst_specialization', {}, { transaction });
    })
};
