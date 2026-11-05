'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SAMPLE_TRANSCRIPT = [
  'Health worker: Good morning doctor, I am with Sunita, 34 years old. She has had fever and a dry cough for four days.',
  'Doctor: Namaste Sunita. Is the fever continuous or does it come and go?',
  'Patient: It comes in the evening, with chills. I also have body ache.',
  'Health worker: Her temperature now is 101.2 F, pulse 96, SpO2 97 percent, BP 118 by 76.',
  'Doctor: Any breathlessness, chest pain or blood in the sputum?',
  'Patient: No, only the cough.',
  'Doctor: Any allergy to medicines? Is she on any medicine now?',
  'Health worker: No known allergies. She took paracetamol yesterday.',
  'Doctor: Please do a malaria rapid test and a CBC at the centre. Give paracetamol 650 mg three times a day for three days, plenty of fluids, and review after three days or earlier if breathing becomes difficult.',
].join('\n');

const SAMPLE_SUMMARY = {
  Vitals: 'Temperature 101.2 F;#Pulse 96/min;#SpO2 97%;#BP 118/76 mmHg',
  Allergy: 'No known drug allergies',
  'Chief Complaints and HOPI': 'Fever for 4 days, evening rise with chills;#Dry cough for 4 days;#Body ache',
  Diagnosis: 'Acute febrile illness, rule out malaria',
  'Orders and Procedures': 'Malaria rapid diagnostic test;#Complete blood count',
  Medications: [
    { medicineName: 'Paracetamol', medicineDosage: '650 mg', medicineFrequency: 'Three times a day', medicineDuration: '3 days' },
  ],
  'Advice and Instructions': 'Plenty of oral fluids;#Return earlier if breathlessness develops',
  Followup: 'Review after 3 days',
  ROS: 'No breathlessness;#No chest pain;#No haemoptysis',
  'Past History': 'Not mentioned',
  'Doctor Notes': 'Teleconsultation via health worker; vitals recorded by health worker at the centre.',
};

class MockVoiceDocClient {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.delayScale = this.cfg.delayScale ?? 1;
    this.recordings = [];
  }

  async prepare() {}

  async uploadChunk({ chunkNumber }) {
    await sleep((250 + Math.random() * 400) * this.delayScale);
    return { status: 'ok', chunk_number: chunkNumber, blob: '' };
  }

  async endStream({ name, fields }) {
    await sleep(1500 * this.delayScale);
    const summary = Object.fromEntries(fields.map((f) => [f, SAMPLE_SUMMARY[f] ?? 'Not mentioned']));
    this.recordings.unshift({ [name]: { summary, transcript: SAMPLE_TRANSCRIPT } });
    return { message: 'End-stream processing successful', transcript: SAMPLE_TRANSCRIPT, summary };
  }

  async uploadCombinedAudio() {
    await sleep(500 * this.delayScale);
    return { message: 'Audio Uploaded Successfully' };
  }

  async patientVisitSummary(name) {
    await sleep(500 * this.delayScale);
    const visits = this.recordings.map((r) => Object.keys(r)[0]).filter((key) => key.split(' ')[0] === name);
    return {
      overall_summary: visits.length ? 'The patient reported four days of fever with evening chills and a dry cough. A malaria test and CBC were ordered, paracetamol was advised, and a review was planned after three days.' : '',
      visits_found: visits.length,
      visits,
    };
  }

  async listRecordings() {
    return { jsons: this.recordings };
  }

  async logout() {}
}

module.exports = { MockVoiceDocClient };
