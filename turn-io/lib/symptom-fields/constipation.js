// Turn's constipation journey sends answers under `symptoms_data`. As with
// fever, the keys here are UNprefixed (since, onset, character, assoc_*, ...)
// even though the raw contact variables are `constipation_`-prefixed -- the
// journey strips the prefix when building symptoms_data.
// Keys here MUST match what symptoms_data actually contains.
// Each entry: payload key -> label, in order.
//

module.exports = [
   // Core symptom fields
   ["since",                        "Constipation since"],
   ["onset",                        "Onset"],
   ["character",                    "Type / nature of constipation"],
   ["stool_frequency",              "Stool frequency"],
   ["straining_duration",           "Time taken to pass stools"],
   ["stool_consistency",            "Stool consistency"],
   ["stool_shape",                  "Stool shape"],
   ["progression",                  "Progression"],
   ["alternating_diarrhea",         "Constipation alternating with diarrhea"],
 
   // Associated symptoms
   ["assoc_abdominal_pain",         "Associated: abdominal pain"],
   ["assoc_vomiting",               "Associated: vomiting"],
   ["assoc_abdominal_distention",   "Associated: abdominal distention"],
   ["assoc_blood_in_stool",         "Associated: blood in stool"],
   ["assoc_black_stools",           "Associated: black stools"],
   ["assoc_anal_pain",              "Associated: anal pain"],
   ["assoc_flatus_difficulty",      "Associated: difficulty passing gases (flatus)"],
   ["assoc_stool_incontinence",     "Associated: stool incontinence"],
   ["assoc_medication_history",     "Associated: history of medication intake"],
 
   // Other associated symptoms + treatment + additional
   ["other_symptoms",               "Other associated symptoms"],
   ["treatment",                    "Treatment"],
   ["treatment_details",            "Treatment details"],
   ["additional",                   "Additional information"],
];
