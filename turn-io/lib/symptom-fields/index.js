// Each module maps one Turn `symptoms_data` payload key -> the label shown
// under the Chief Complaint, in display order.
const ABD_PAIN_FIELDS = require("./abdominal-pain");
const COUGH_FIELDS = require("./cough");
const THROAT_PAIN_FIELDS = require("./throat-pain");
const HEADACHE_FIELDS = require("./headache");
const DIARRHEA_FIELDS = require("./diarrhea");
const FATIGUE_FIELDS = require("./fatigue");

// Maps the Chief Complaint (Turn's `symptom` / `results.main_problem`,
// lowercased) to the field list that describes its `symptoms_data` shape, so
// unrelated symptoms' fields don't get merged into one long, duplicate-prone
// row list.
const FIELDS_BY_SYMPTOM = {
   "cough":          COUGH_FIELDS,
   "abdominal pain": ABD_PAIN_FIELDS,
   "throat pain":    THROAT_PAIN_FIELDS,
   "headache":       HEADACHE_FIELDS,
   "diarrhea":       DIARRHEA_FIELDS,
   "fatigue":        FATIGUE_FIELDS,
};

// Fallback for symptoms without a dedicated field list.
const ALL_FIELDS = [
   ...ABD_PAIN_FIELDS,
   ...COUGH_FIELDS,
   ...THROAT_PAIN_FIELDS,
   ...HEADACHE_FIELDS,
   ...DIARRHEA_FIELDS,
   ...FATIGUE_FIELDS,
];

module.exports = { FIELDS_BY_SYMPTOM, ALL_FIELDS };
