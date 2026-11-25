const crypto = require('crypto');

const ADULT_INITIAL = 'ADULTINITIAL';
const VITALS = 'Vitals';

const SECTIONS = [
  { key: 'Chief_complaint', match: 'COMPLAINT' },
  { key: 'Physical_examination', match: 'PHYSICAL EXAMINATION' },
  { key: 'Family_history', match: 'FAMILY HISTORY' },
  { key: 'Medical_history', match: 'MEDICAL HISTORY' },
];

const formatText = (text) => {
  if (!text) {
    return '';
  }
  return String(text)
    .replace(/<br\/>/g, '\n')
    .replace(/<b>/g, '**')
    .replace(/<\/b>/g, '**')
    .replace(/►/g, '')
    .trim();
};

const formatAge = (birthdate, age) => {
  if (birthdate) {
    const dob = new Date(birthdate);
    if (!isNaN(dob.getTime())) {
      const now = new Date();
      const days = Math.max(0, Math.floor((now.getTime() - dob.getTime()) / 86400000));
      if (days <= 28) {
        return `${days} day${days === 1 ? '' : 's'}`;
      }
      let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
      if (now.getDate() < dob.getDate()) {
        months -= 1;
      }
      if (months < 0) {
        months = 0;
      }
      if (months < 24) {
        return `${months} month${months === 1 ? '' : 's'}`;
      }
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      if (years >= 18) {
        return `${years} years`;
      }
      return remMonths > 0
        ? `${years} years ${remMonths} month${remMonths === 1 ? '' : 's'}`
        : `${years} years`;
    }
  }
  if (age !== undefined && age !== null && age !== '' && Number(age) > 0) {
    return `${age} year${Number(age) === 1 ? '' : 's'}`;
  }
  return 'Not specified';
};

const genderLabel = (gender) => {
  if (!gender) {
    return 'Not specified';
  }
  return gender;
};

const conceptDisplay = (obsRow) => {
  const names = obsRow?.concept?.names || [];
  const preferred = names.find((n) => n.locale_preferred) || names.find((n) => n.concept_name_type === 'FULLY_SPECIFIED');
  return (preferred || names[0])?.name || '';
};

const obsValue = (obsRow) => {
  if (obsRow?.value_text !== null && obsRow?.value_text !== undefined) {
    return obsRow.value_text;
  }
  if (obsRow?.value_numeric !== null && obsRow?.value_numeric !== undefined) {
    return obsRow.value_numeric;
  }
  return '';
};

const groupObsByEncounterType = (obsRows) => {
  const grouped = {};
  (obsRows || []).forEach((row) => {
    const typeName = row?.encounter_type_name;
    if (!typeName) {
      return;
    }
    grouped[typeName] = (grouped[typeName] || []).concat(row);
  });
  return grouped;
};

const buildCaseHistory = (visitRow) => {
  const grouped = groupObsByEncounterType(visitRow?.obsRows);
  const adultInitial = grouped[ADULT_INITIAL] || [];
  const vitals = grouped[VITALS] || [];

  const sectionText = SECTIONS.map(({ key, match }) => {
    const row = adultInitial.find((o) => conceptDisplay(o).includes(match));
    return `${key}: ${formatText(obsValue(row))}`;
  }).join('\n\n');

  const vitalPayload = vitals.length
    ? `\nVitals: \n${vitals.map((v) => `${conceptDisplay(v)}: ${obsValue(v)}`).join('\n')}`
    : '';

  return `Gender: ${genderLabel(visitRow?.person?.gender)}
Age: ${formatAge(visitRow?.person?.birthdate, null)}

${sectionText}

${vitalPayload}

`;
};

const JSON_SUMMARY_CONCEPT_UUID = '1f770363-262e-4d01-b1df-3eb164d575ef';
const JSON_SUMMARY_CONCEPT_NAME = 'JSON Format Visit Summary';

const serializePayload = (payload) => (typeof payload === 'string' ? payload : JSON.stringify(payload));

const hashPayload = (payload) => crypto.createHash('sha256').update(serializePayload(payload)).digest('hex');

const isJsonSummaryObs = (obsRow) => {
  if (obsRow?.concept?.uuid) {
    return obsRow.concept.uuid === JSON_SUMMARY_CONCEPT_UUID;
  }
  return (obsRow?.concept?.names || []).some((n) => n.name === JSON_SUMMARY_CONCEPT_NAME);
};

const extractJsonVisitSummary = (visitRow) => {
  const grouped = groupObsByEncounterType(visitRow?.obsRows);
  const obs = (grouped[ADULT_INITIAL] || []).find(
    (o) => isJsonSummaryObs(o) && o.value_text !== null && o.value_text !== undefined && String(o.value_text).trim() !== ''
  );
  if (!obs) {
    return { payload: null, reason: 'obs missing' };
  }
  try {
    const parsed = JSON.parse(obs.value_text);
    if (parsed === null || typeof parsed !== 'object') {
      return { payload: null, reason: 'parse error' };
    }
    return { payload: parsed, reason: null };
  } catch (error) {
    return { payload: null, reason: 'parse error' };
  }
};

const buildCasePayload = (visitRow, { jsonEnabled = false } = {}) => {
  if (!jsonEnabled) {
    return { casehistory: buildCaseHistory(visitRow), source: 'text', reason: 'flag off' };
  }
  const { payload, reason } = extractJsonVisitSummary(visitRow);
  if (payload) {
    return { casehistory: JSON.stringify(payload), source: 'json', reason: null };
  }
  return { casehistory: buildCaseHistory(visitRow), source: 'text', reason };
};

module.exports = {
  buildCaseHistory,
  groupObsByEncounterType,
  hashPayload,
  serializePayload,
  extractJsonVisitSummary,
  buildCasePayload,
  JSON_SUMMARY_CONCEPT_UUID,
  JSON_SUMMARY_CONCEPT_NAME,
  formatText,
  formatAge,
  genderLabel,
  conceptDisplay,
  obsValue,
};
