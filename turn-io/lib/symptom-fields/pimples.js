// symptom-fields/pimple.js
//
// Field-key -> human label map for the Pimples protocol.
// Keys match the `symptoms_data` keys sent in the visit_push payload
// (i.e. the JSON keys, not the prefixed Turn contact fields).
//
// MULTI-SELECT fields (WhatsApp flow returns an ARRAY -> store as a
// comma-joined string via reduce, same as fever_constitutional_symptoms):
//   location, character, aggravating, associated_features,
//   other_associated_symptoms
//
// The "assoc_*" rows below are individual single-choice Yes/No questions.

module.exports = [
  ["since",                     "When did it start"],
  ["onset",                     "Onset"],
  ["location",                  "Location"],
  ["character",                 "Character / appearance"],
  ["aggravating",               "Aggravating factors"],
  ["associated_features",       "Associated features"],
  ["progression",               "Progression"],

  ["assoc_excess_body_hair",    "Associated: excess body hair"],
  ["assoc_absent_periods",      "Associated: absent periods"],
  ["assoc_pelvic_pain",         "Associated: pelvic pain"],
  ["assoc_skin_rash",           "Associated: skin rash"],
  ["assoc_hair_fall",           "Associated: hair fall"],

  ["other_associated_symptoms", "Other associated symptoms"],

  ["treatment",                 "Any treatment sought"],
  ["treatment_details",         "Treatment details"],
  ["additional",                "Additional information"],

  ["weight",                    "Weight"],
];