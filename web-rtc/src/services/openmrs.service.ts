import axios from 'axios';

const PHONE_ATTRIBUTE = process.env.OPENMRS_PHONE_ATTRIBUTE || 'Telephone Number';

const PATIENT_REP =
  'custom:(uuid,person:(display,preferredName:(givenName,familyName),' +
  'attributes:(value,attributeType:(display))))';

const restBase = () => (process.env.OPENMRS_REST_URL || '').replace(/\/+$/, '');

const basicAuth = () =>
  'Basic ' +
  Buffer.from(
    `${process.env.OPENMRS_USERNAME || ''}:${process.env.OPENMRS_PASSWORD || ''}`
  ).toString('base64');

export interface PatientContact {
  phone: string | null;
  name: string | null;
}

export async function getPatientContact(patientUuid: string): Promise<PatientContact> {
  if (!restBase()) {
    throw new Error('OPENMRS_REST_URL is not set');
  }

  const { data } = await axios.get(`${restBase()}/patient/${patientUuid}`, {
    params: { v: PATIENT_REP },
    headers: { Authorization: basicAuth(), Accept: 'application/json' },
    timeout: 15000,
  });

  const person = data?.person;
  const attributes: any[] = person?.attributes || [];
  const phone = attributes.find(
    (a) => a?.attributeType?.display === PHONE_ATTRIBUTE
  )?.value;

  const preferred = person?.preferredName;
  const name = preferred
    ? [preferred.givenName, preferred.familyName].filter(Boolean).join(' ')
    : person?.display || null;

  return {
    phone: phone ? String(phone).trim() : null,
    name: name || null,
  };
}
