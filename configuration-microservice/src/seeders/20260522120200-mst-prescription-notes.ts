import { QueryInterface } from 'sequelize';

const DEFAULT_SPECIALTY_NOTES: Array<{ specialty: string; notes: string[] }> = [
  {
    specialty: 'Dermatologist',
    notes: [
      'Do not self-prescribe or continue medicines without follow-up.',
      'Dosage and medicines may change in the next treatment plan.',
      'Inform the doctor if pregnant, planning pregnancy, or breastfeeding.',
      'Avoid applying creams/ointments on eyes, mouth, or sensitive areas unless advised.',
      'Stop medicines and seek medical help if severe rash, swelling, burning, or allergy develops.',
      'Strictly attend follow-up visits as advised by the doctor.',
    ],
  },
  {
    specialty: 'Gynaecologist',
    notes: [      
      'Inform the doctor if pregnant, planning pregnancy, breastfeeding, or if periods are missed.',
      'Do not take hormonal or gynecological medicines without medical advice.',
      'Maintain proper hygiene and follow medicine timings carefully.',
      'Seek immediate medical care for severe abdominal pain, heavy bleeding, fainting, or severe vomiting.',
      'Attend follow-up visits and investigations as advised.',
      'Visit the nearest hospital immediately if symptoms worsen or new symptoms develop.',
    ],
  },
  {
    specialty: 'Orthopaedic',
    notes: [
      'Avoid excessive physical strain, heavy lifting, or sudden movements during recovery.',
      'Follow prescribed exercises, physiotherapy, and rest recommendations properly.',
      'Use supportive devices (belt, brace, walker, etc.) only if advised by the doctor.',
      'Seek medical advice if swelling, numbness, movement difficulty, or severe pain increases.',
      'Do not continue painkillers for long periods without follow-up consultation.',
      'Visit the nearest hospital immediately if symptoms worsen or new symptoms develop.',
    ]
  },
  {
    specialty: 'Pedriatician',
    notes: [
      'Medicines should only be given by a parent/caregiver as instructed by the doctor.',
      'Do not change the dosage without consulting the doctor.',
      'Use proper measuring devices for syrups and drops.',
      'Seek urgent medical care if the child develops breathing difficulty, persistent fever, seizures, or reduced feeding.',
      'Keep medicines out of reach of children.',
      'Visit the nearest hospital immediately if symptoms worsen or new symptoms develop.',
    ]
  },
  {
    specialty: 'General Physician',
    notes: [
      'Complete the full course of medicines even if symptoms improve early.',
      'Drink adequate water, take proper rest, and maintain a healthy diet.',
      'Monitor fever, blood pressure, sugar, or other symptoms as advised.',
      'Avoid taking additional over-the-counter medicines without consulting the doctor.',
      'Seek urgent medical care for high fever, breathing difficulty, chest pain, confusion, or severe weakness.',
      'Visit the nearest hospital immediately if symptoms worsen or new symptoms develop.',
    ],
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        'mst_prescription_notes',
        DEFAULT_SPECIALTY_NOTES.map((row) => ({
          specialty: row.specialty,
          notes: JSON.stringify(row.notes),
          is_enabled: true,
          platform: 'Both',
        })),
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        'mst_prescription_notes',
        { specialty: DEFAULT_SPECIALTY_NOTES.map((r) => r.specialty) },
        { transaction }
      );
    }),
};
