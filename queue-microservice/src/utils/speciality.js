const { SPEC_MATCH, GENERAL_SPECIALITIES } = require("../constants");

const normalise = (value) => String(value || "").trim().toLowerCase();

const isGeneral = (speciality) => GENERAL_SPECIALITIES.includes(normalise(speciality));

/**
 * Priority Engine §02.4 / backend LLD §06.
 * EXACT   — the doctor's speciality is the case's speciality
 * GENERAL — either side is a general/GP speciality
 * NONE    — unrelated
 */
const matchLevel = (caseSpeciality, doctorSpeciality) => {
  const a = normalise(caseSpeciality);
  const b = normalise(doctorSpeciality);
  if (!a || !b) return SPEC_MATCH.NONE;
  if (a === b) return SPEC_MATCH.EXACT;
  if (isGeneral(a) || isGeneral(b)) return SPEC_MATCH.GENERAL;
  return SPEC_MATCH.NONE;
};

module.exports = { normalise, isGeneral, matchLevel };
