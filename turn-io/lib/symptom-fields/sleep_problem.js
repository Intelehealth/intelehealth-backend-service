// symptom-fields/sleep_problem.js
//
// Field-key -> human label map for the Sleep problem protocol.
// Keys match the `symptoms_data` keys sent in the visit_push payload
// (i.e. the JSON keys, not the prefixed Turn contact fields).
//
// MULTI-SELECT fields (WhatsApp flow returns an ARRAY -> store as a
// comma-joined string via reduce, same as fever_constitutional_symptoms):
//   character, other_associated_symptoms
//   (wake_up_due_to may also be multi-select - verify against the sheet)
//
// The "assoc_*" rows below are individual single-choice Yes/No questions.

module.exports = [
  ["since",                       "When did it start"],
  ["onset",                       "Onset"],
  ["character",                   "Character of sleep problem"],
  ["bedtime",                     "Bedtime"],
  ["time_to_fall_asleep",         "Time taken to fall asleep"],
  ["midnight_awakenings",         "Midnight awakenings"],
  ["wake_up_count",               "Number of times waking up"],
  ["wake_up_due_to",              "What wakes you up"],
  ["time_back_to_sleep",          "Time taken to go back to sleep"],
  ["wake_up_time",                "Wake up time"],
  ["sleep_duration",              "Sleep duration"],
  ["optimal_duration",            "Optimal sleep duration to feel rested"],
  ["feel_well_rested",            "Feels well-rested on waking"],
  ["hours_to_feel_refreshed",     "Hours after waking to feel refreshed"],
  ["daytime_sleepiness",          "Excessive daytime sleepiness or fatigue"],
  ["daytime_naps",                "Takes daytime naps"],
  ["nap_duration",                "Duration of daytime naps"],
  ["nap_frequency",               "Frequency of daytime naps"],
  ["progression",                 "Progression"],

  ["assoc_snoring",               "Associated: snoring"],
  ["assoc_restless_legs",         "Associated: restlessness in the legs"],
  ["assoc_jerky_leg_movements",   "Associated: jerky leg movements"],
  ["assoc_medication_history",    "Associated: history of medication intake"],
  ["assoc_head_injury_history",   "Associated: history of head injury"],

  ["other_associated_symptoms",   "Other associated symptoms"],

  ["treatment",                   "Any treatment sought"],
  ["treatment_details",           "Treatment details"],
  ["additional",                  "Additional information"],

  ["weight",                      "Weight"],
];