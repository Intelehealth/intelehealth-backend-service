// Turn's fever journey sends answers under `symptoms_data`. Note the keys are
// mostly UNprefixed (onset, severity, assoc_headache, ...) even though the raw
// contact variables are `fever_`-prefixed -- the journey strips the prefix when
// building symptoms_data, except `fever_start_time`. Keys here MUST match what
// symptoms_data actually contains. Each entry: payload key -> label, in order.
module.exports = [
   // Core symptom fields
   ["fever_start_time",             "Fever started"],
   ["onset",                        "Onset"],
   ["character",                    "Character"],
   ["frequency",                    "Frequency"],
   ["severity",                     "Severity"],
   ["timing",                       "Timing"],
   ["constitutional_symptoms",      "Constitutional symptoms"],
   ["progression",                  "Progression"],

   // Associated symptoms
   ["assoc_headache",               "Associated: headache"],
   ["assoc_vomiting",               "Associated: vomiting"],
   ["assoc_throat_pain",            "Associated: throat pain"],
   ["assoc_ear_pain",               "Associated: ear pain"],
   ["assoc_skin_rash",              "Associated: skin rash"],
   ["assoc_burning_urination",      "Associated: burning urination"],
   ["assoc_cough",                  "Associated: cough"],
   ["assoc_runny_nose",             "Associated: runny nose"],
   ["assoc_loss_smell",             "Associated: loss of smell"],
   ["assoc_loss_taste",             "Associated: loss of taste"],
   ["assoc_sinus_pain",             "Associated: sinus pain"],
   ["assoc_loose_stools",           "Associated: loose stools"],
   ["assoc_abdominal_pain",         "Associated: abdominal pain"],
   ["assoc_jaundice",               "Associated: jaundice"],
   ["assoc_flank_pain",             "Associated: flank pain"],
   ["assoc_chest_pain",             "Associated: chest pain"],
   ["assoc_contact_sick",           "Associated: contact with sick person"],
   ["assoc_recent_travel",          "Associated: recent travel"],

   // Other associated symptoms + treatment + additional
   ["other_associated_symptoms",    "Other associated symptoms"],
   ["other_sym_other",              "Other associated symptoms (other)"],
   ["treatment",                    "Treatment"],
   ["treatment_details",            "Treatment details"],
   ["additional",                   "Additional information"],
];
