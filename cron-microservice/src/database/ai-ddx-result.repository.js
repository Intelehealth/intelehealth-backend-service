const { database, openMrsDatabase } = require('./index');
const { buildCaseHistory, hashPayload } = require('../crons/services/ddx-payload.service');
const aiMiddleware = require('../crons/services/ai-middleware.service');

const STATUS_DONE = 'done';
const STATUS_FAILED = 'failed';

const VISIT_PAYLOAD_QUERY = `SELECT
    v.visit_id,
    v.uuid AS visit_uuid,
    p.uuid AS patient_uuid,
    p.gender,
    p.birthdate,
    o.obs_id,
    o.value_text,
    o.value_numeric,
    et.name AS encounter_type_name,
    cn.name AS concept_name,
    cn.locale_preferred,
    cn.concept_name_type
  FROM visit v
  LEFT JOIN person p ON p.person_id = v.patient_id
  LEFT JOIN encounter e ON e.visit_id = v.visit_id AND e.voided = 0
  LEFT JOIN encounter_type et ON et.encounter_type_id = e.encounter_type
  LEFT JOIN obs o ON o.encounter_id = e.encounter_id AND o.voided = 0
  LEFT JOIN concept c ON c.concept_id = o.concept_id
  LEFT JOIN concept_name cn ON cn.concept_id = c.concept_id AND cn.voided = 0
  WHERE v.uuid = :visitUuid AND v.voided = 0`;

const buildVisitRow = (flatRows) => {
  if (!flatRows.length) {
    return null;
  }
  const first = flatRows[0];
  const obsById = new Map();

  for (const row of flatRows) {
    if (row.obs_id == null) {
      continue;
    }
    if (!obsById.has(row.obs_id)) {
      obsById.set(row.obs_id, {
        value_text: row.value_text,
        value_numeric: row.value_numeric,
        encounter_type_name: row.encounter_type_name,
        concept: { names: [] },
      });
    }
    if (row.concept_name != null) {
      obsById.get(row.obs_id).concept.names.push({
        name: row.concept_name,
        locale_preferred: row.locale_preferred,
        concept_name_type: row.concept_name_type,
      });
    }
  }

  return {
    visit_id: first.visit_id,
    uuid: first.visit_uuid,
    person: {
      uuid: first.patient_uuid,
      gender: first.gender,
      birthdate: first.birthdate,
    },
    obsRows: [...obsById.values()],
  };
};

const loadVisitForPayload = async (visitUuid) => {
  const [rows] = await openMrsDatabase.query(VISIT_PAYLOAD_QUERY, { visitUuid });
  return buildVisitRow(rows);
};

const findResult = async (visitUuid) => {
  const [rows] = await database.query('SELECT * FROM ai_ddx_results WHERE visit_uuid = :visitUuid LIMIT 1', {
    visitUuid,
  });
  return rows[0] || null;
};

const assertUsableResponse = (response, visitUuid) => {
  const data = response?.result?.data;
  if (!data || !Array.isArray(data.result)) {
    const err = new Error(`DDx response for ${visitUuid} has no usable result payload`);
    err.code = 'DDX_EMPTY_RESPONSE';
    err.responseBody = response ?? null;
    throw err;
  }
  return data;
};

const upsertSuccess = async (existing, values) => {
  const now = new Date();
  if (existing) {
    await database.query(
      `UPDATE ai_ddx_results SET
         patient_uuid = :patient_uuid,
         payload_hash = :payload_hash,
         request_payload = :request_payload,
         response = :response,
         conclusion = :conclusion,
         status = :status,
         error = NULL,
         attempts = :attempts,
         computed_at = :computed_at,
         updatedAt = :now
       WHERE id = :id`,
      {
        ...values,
        response: JSON.stringify(values.response),
        attempts: existing.attempts + 1,
        now,
        id: existing.id,
      }
    );
    return;
  }

  await database.query(
    `INSERT INTO ai_ddx_results
       (visit_uuid, patient_uuid, payload_hash, request_payload, response, conclusion, status, attempts, computed_at, createdAt, updatedAt)
     VALUES
       (:visit_uuid, :patient_uuid, :payload_hash, :request_payload, :response, :conclusion, :status, 1, :computed_at, :now, :now)`,
    { ...values, response: JSON.stringify(values.response), now }
  );
};

const computeForVisit = async (visitUuid, { timeout } = {}) => {
  const visitRow = await loadVisitForPayload(visitUuid);
  if (!visitRow) {
    const err = new Error(`Visit ${visitUuid} not found`);
    err.code = 'VISIT_NOT_FOUND';
    throw err;
  }

  const casehistory = buildCaseHistory(visitRow);
  const payloadHash = hashPayload(casehistory);
  const patientUuid = visitRow?.person?.uuid || null;

  const existing = await findResult(visitUuid);
  if (existing && existing.status === STATUS_DONE && existing.payload_hash === payloadHash) {
    return { skipped: true };
  }

  let response;
  let data;
  try {
    response = await aiMiddleware.ddx({ casehistory, visitUuid }, { timeout });
    data = assertUsableResponse(response, visitUuid);
  } catch (error) {
    error.ddxContext = {
      patient_uuid: patientUuid,
      payload_hash: payloadHash,
      request_payload: casehistory,
      response: error.responseBody ?? null,
    };
    throw error;
  }
  const conclusion = response?.conclusion || data.conclusion || '';

  await upsertSuccess(existing, {
    visit_uuid: visitUuid,
    patient_uuid: patientUuid,
    payload_hash: payloadHash,
    request_payload: casehistory,
    response,
    conclusion,
    status: STATUS_DONE,
    computed_at: new Date(),
  });

  return { skipped: false };
};

const recordFailure = async (visitUuid, error) => {
  const existing = await findResult(visitUuid);
  const now = new Date();
  const message = error?.message || String(error);
  const context = error?.ddxContext || {};
  const details = {
    patient_uuid: context.patient_uuid ?? null,
    payload_hash: context.payload_hash ?? null,
    request_payload: context.request_payload ?? null,
    response: context.response == null ? null : JSON.stringify(context.response),
  };

  if (existing) {
    await database.query(
      `UPDATE ai_ddx_results SET
         status = :status,
         error = :error,
         attempts = :attempts,
         patient_uuid = COALESCE(:patient_uuid, patient_uuid),
         payload_hash = COALESCE(:payload_hash, payload_hash),
         request_payload = COALESCE(:request_payload, request_payload),
         response = COALESCE(:response, response),
         updatedAt = :now
       WHERE id = :id`,
      { ...details, status: STATUS_FAILED, error: message, attempts: existing.attempts + 1, now, id: existing.id }
    );
    return;
  }

  await database.query(
    `INSERT INTO ai_ddx_results
       (visit_uuid, patient_uuid, payload_hash, request_payload, response, status, error, attempts, createdAt, updatedAt)
     VALUES
       (:visit_uuid, :patient_uuid, :payload_hash, :request_payload, :response, :status, :error, 1, :now, :now)`,
    { ...details, visit_uuid: visitUuid, status: STATUS_FAILED, error: message, now }
  );
};

module.exports = {
  loadVisitForPayload,
  findResult,
  computeForVisit,
  recordFailure,
};
