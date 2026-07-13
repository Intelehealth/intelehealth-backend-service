// symptom-fields/runny-nose.js
//
// Field-key -> human label map for the Runny nose protocol.
// Keys match the `symptoms_data` keys sent in the visit_push payload
// (i.e. the JSON keys, not the prefixed Turn contact fields).
//
// MULTI-SELECT fields (WhatsApp flow returns an ARRAY -> store as a
// comma-joined string via reduce, same as fever_constitutional_symptoms):
//   aggravating, other_associated_symptoms
//
// The "assoc_*" rows below are individual single-choice Yes/No questions.

module.exports = [
  ["since",                     "When did it start"],
  ["onset",                     "Onset"],
  ["side",                      "Side / which nostril"],
  ["character",                 "Character of discharge"],
  ["timing",                    "Timing"],
  ["aggravating",               "Aggravating factors"],
  ["progression",               "Progression"],

  ["assoc_nose_block",          "Associated: nose block"],
  ["assoc_stuffy_nose",         "Associated: stuffy nose"],
  ["assoc_excessive_sneezing",  "Associated: excessive sneezing"],
  ["assoc_nose_bleeding",       "Associated: nose bleeding"],
  ["assoc_facial_sinus_pain",   "Associated: facial (sinus) pain"],
  ["assoc_loss_of_smell",       "Associated: loss of smell"],
  ["assoc_snoring",             "Associated: snoring"],
  ["assoc_mouth_breathing",     "Associated: mouth breathing"],
  ["assoc_postnasal_drip",      "Associated: postnasal drip"],
  ["assoc_bad_breath",          "Associated: bad breath"],
  ["assoc_swelling_of_nose",    "Associated: swelling of nose"],
  ["assoc_cough",               "Associated: cough"],
  ["assoc_throat_pain",         "Associated: throat pain"],
  ["assoc_ear_pain",            "Associated: ear pain"],

  ["other_associated_symptoms", "Other associated symptoms"],

  ["treatment",                 "Any treatment sought"],
  ["treatment_details",         "Treatment details"],
  ["additional",                "Additional information"],

  ["weight",                    "Weight"],
];