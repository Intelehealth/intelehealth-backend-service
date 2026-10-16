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

const hashPayload = (payload) => crypto.createHash('sha256').update(payload).digest('hex');

module.exports = {
  buildCaseHistory,
  groupObsByEncounterType,
  hashPayload,
  formatText,
  formatAge,
  genderLabel,
  conceptDisplay,
  obsValue,
};
