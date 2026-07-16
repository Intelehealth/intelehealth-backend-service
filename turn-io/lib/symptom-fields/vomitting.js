
// Turn's vomiting journey sends answers under `symptoms_data`. As with fever,
// the keys here are UNprefixed (since, onset, character, assoc_*, ...) even
// though the raw contact variables are `vomiting_`-prefixed -- the journey
// strips the prefix when building symptoms_data.
// Keys here MUST match what symptoms_data actually contains.
// Each entry: payload key -> label, in order.
//

module.exports = [
   // Core symptom fields
   ["since",                        "Vomiting since"],
   ["onset",                        "Onset"],
   ["character",                    "Character of vomitus"],
   ["timing",                       "Timing"],
   ["diurnal_variation",            "Diurnal variation"],
   ["relation_to_meal",             "Relation to meals"],
   ["frequency",                    "Frequency"],
   ["quantity",                     "Quantity of vomitus"],
   ["force",                        "Force (projectile / effortless)"],
   ["relieving_factors",            "Relieving factors"],
   ["aggravating_factors",          "Aggravating factors"],
   ["progression",                  "Progression"],
 
   // Associated symptoms
   ["assoc_nausea",                 "Associated: nausea"],
   ["assoc_diarrhea",               "Associated: diarrhea"],
   ["assoc_abdominal_pain",         "Associated: abdominal pain"],
   ["assoc_abdominal_distention",   "Associated: abdominal distention"],
   ["assoc_heartburn",              "Associated: heartburn"],
   ["assoc_jaundice",               "Associated: jaundice"],
   ["assoc_constipation",           "Associated: constipation"],
   ["assoc_black_stools",           "Associated: black stools"],
   ["assoc_decreased_urine",        "Associated: decreased urine"],
   ["assoc_frequency_urination",    "Associated: frequency of urination"],
   ["assoc_recent_travel",          "Associated: history of recent travel"],
   ["assoc_sick_contact",           "Associated: contact with sick persons"],
 
   // Other associated symptoms + treatment + additional
   ["other_associated_symptoms",    "Other associated symptoms"],
   ["treatment",                    "Treatment"],
   ["treatment_details",            "Treatment details"],
   ["additional",                   "Additional information"],
];