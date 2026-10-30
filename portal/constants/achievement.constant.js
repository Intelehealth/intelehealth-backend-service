"use strict";

/**
 * Constants for the Achievements summary and activity heartbeat APIs.
 * Attribute and encounter types are matched by UUID because numeric ids
 * can differ between OpenMRS installations.
 */
module.exports = {
  // person_attribute_type "providerUUID": holds the provider who registered the patient
  PROVIDER_ATTRIBUTE_TYPE_UUID: "84f94425-789d-4293-a0d8-9dc01dbb4f07",
  // person_attribute_type "createdDate": the date the patient was registered
  CREATED_DATE_ATTRIBUTE_TYPE_UUID: "ffc8ebee-f70c-4743-bc3c-2fe4ac843245",
  // encounter_type "ADULTINITIAL": the first encounter of a visit, recorded by the nurse who registers it
  INITIAL_ENCOUNTER_TYPE_UUID: "8d5b27bc-c2cc-11de-8d13-0010c6dffd0f",
  // encounter_type "Visit Complete": the doctor has given all the medication and advice
  VISIT_COMPLETE_ENCOUNTER_TYPE_UUID: "bd1fbfaa-f5fb-4ebd-b75c-564506fc309e",
  // encounter_type "Patient Exit Survey": also marks a visit as finished
  PATIENT_EXIT_SURVEY_ENCOUNTER_TYPE_UUID: "629a9d0b-48eb-405e-953d-a5964c88dc30",

  SECONDS_PER_DAY: 86400,
  // A heartbeat may report that its period ended this long ago at most (a day), for time saved while offline.
  MAX_ENDED_SECONDS_AGO: 86400,
  // The largest allowance ACHIEVEMENTS_HEARTBEAT_TOLERANCE_SECONDS may set (see DEFAULTS).
  MAX_HEARTBEAT_TOLERANCE_SECONDS: 5,
  PERIODS: ["today", "overall"],

  // Values whose rule may still change.
  PROVISIONAL_FIELDS: ["doctorVisitsToday", "doctorVisitsCompletedTotal", "visitsPendingFromDoctor", "status"],

  DEFAULTS: {
    TZ_OFFSET_MINUTES: 330,
    // One beat can report up to an hour. The app sends its working time when something happens (the
    // page is hidden or closed, a logout, the connection returns, the next page load), and a stretch
    // longer than this goes out in pieces of this size.
    HEARTBEAT_MAX_SECONDS: 3600,
    // The longest date range the summary accepts. ACHIEVEMENTS_MAX_RANGE_DAYS overrides it.
    MAX_RANGE_DAYS: 366,
    // Allowance for a beat that arrives a moment early. It is 0: the app no longer sends a steady stream of
    // beats, so there is nothing to make up for, and any allowance is added again by every repeat of a
    // request (a retry after a lost answer, a reload), which would inflate the daily total. A deployment
    // that does want one can set ACHIEVEMENTS_HEARTBEAT_TOLERANCE_SECONDS, up to
    // MAX_HEARTBEAT_TOLERANCE_SECONDS.
    HEARTBEAT_TOLERANCE_SECONDS: 0,
  },
};
