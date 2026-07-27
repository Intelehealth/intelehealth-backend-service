// Each module maps one Turn `symptoms_data` payload key -> the label shown
// under the Chief Complaint, in display order.
const ABD_PAIN_FIELDS = require("./abdominal-pain");
const COUGH_FIELDS = require("./cough");
const THROAT_PAIN_FIELDS = require("./throat-pain");
const HEADACHE_FIELDS = require("./headache");
const DIARRHEA_FIELDS = require("./diarrhea");
const FEVER_FIELDS = require("./fever");
const PIMPLES_FIELDS = require("./pimples");
const RUNNY_NOSE_FIELDS = require("./runny-nose");
const SLEEP_PROBLEM_FIELDS = require("./sleep_problem");
const FATIGUE_FIELDS = require("./fatigue");
const VOMITING_FIELDS = require("./vomitting");
const CONSTIPATION_FIELDS = require("./constipation");
const BACK_PAIN_FIELDS = require("./back-pain");

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
   "fever":          FEVER_FIELDS,
   "pimples":        PIMPLES_FIELDS,
   "runny nose":     RUNNY_NOSE_FIELDS,
   "sleep problem":  SLEEP_PROBLEM_FIELDS,
   "vomiting":       VOMITING_FIELDS,
   "constipation":   CONSTIPATION_FIELDS,
   "back pain":      BACK_PAIN_FIELDS
};

// Fallback for symptoms without a dedicated field list. Deduped by key: many
// symptom files share keys (onset, character, progression, treatment, weight...),
// so without dedup an unregistered symptom would render the same row many times.
const ALL_FIELDS = (() => {
   const seen = new Set();
   const merged = [];
   for (const [key, label] of [
      ...ABD_PAIN_FIELDS, ...COUGH_FIELDS, ...THROAT_PAIN_FIELDS,
      ...HEADACHE_FIELDS, ...DIARRHEA_FIELDS, ...FEVER_FIELDS, ...PIMPLES_FIELDS,
      ...RUNNY_NOSE_FIELDS, ...SLEEP_PROBLEM_FIELDS, ...FATIGUE_FIELDS,
      ...VOMITING_FIELDS, ...CONSTIPATION_FIELDS,...BACK_PAIN_FIELDS
   ]) {
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push([key, label]);
   }
   return merged;
})();

module.exports = { FIELDS_BY_SYMPTOM, ALL_FIELDS };
