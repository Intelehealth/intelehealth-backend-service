const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  buildCaseHistory,
  buildCasePayload,
  hashPayload,
  JSON_SUMMARY_CONCEPT_UUID,
} = require('../crons/services/ddx-payload.service');

const summary = { extraction: { demographic: { age: 30 }, chief_complaint: 'fever' } };

const jsonObs = (value, { uuid = JSON_SUMMARY_CONCEPT_UUID, name = 'JSON Format Visit Summary' } = {}) => ({
  value_text: value,
  value_numeric: null,
  encounter_type_name: 'ADULTINITIAL',
  concept: { uuid, names: [{ name, locale_preferred: 1, concept_name_type: 'FULLY_SPECIFIED' }] },
});

const baseRows = [
  {
    value_text: 'fever',
    value_numeric: null,
    encounter_type_name: 'ADULTINITIAL',
    concept: { uuid: 'c-1', names: [{ name: 'CURRENT COMPLAINT', locale_preferred: 1, concept_name_type: 'FULLY_SPECIFIED' }] },
  },
];

const visit = (...extra) => ({ person: { gender: 'F', birthdate: '1990-01-01' }, obsRows: [...baseRows, ...extra] });

test('flag off returns the legacy string unchanged', () => {
  const v = visit(jsonObs(JSON.stringify(summary)));
  const built = buildCasePayload(v, { jsonEnabled: false });
  assert.equal(built.source, 'text');
  assert.equal(built.reason, 'flag off');
  assert.equal(built.casehistory, buildCaseHistory(v));
});

test('flags on with the obs present returns the parsed object', () => {
  const built = buildCasePayload(visit(jsonObs(JSON.stringify(summary))), { jsonEnabled: true });
  assert.equal(built.source, 'json');
  assert.deepEqual(built.casehistory, summary);
});

test('obs is matched by concept name when the uuid is absent', () => {
  const obs = jsonObs(JSON.stringify(summary), { uuid: null });
  const built = buildCasePayload(visit(obs), { jsonEnabled: true });
  assert.equal(built.source, 'json');
});

test('an obs with another concept uuid is ignored', () => {
  const built = buildCasePayload(visit(jsonObs(JSON.stringify(summary), { uuid: 'other' })), { jsonEnabled: true });
  assert.equal(built.source, 'text');
  assert.equal(built.reason, 'obs missing');
});

test('flags on with the obs missing falls back to the string', () => {
  const v = visit();
  const built = buildCasePayload(v, { jsonEnabled: true });
  assert.equal(built.source, 'text');
  assert.equal(built.reason, 'obs missing');
  assert.equal(built.casehistory, buildCaseHistory(v));
});

test('malformed or non-object JSON falls back to the string', () => {
  for (const bad of ['{not json', 'null', '"text"', '42']) {
    const built = buildCasePayload(visit(jsonObs(bad)), { jsonEnabled: true });
    assert.equal(built.source, 'text');
    assert.equal(built.reason, 'parse error');
    assert.equal(typeof built.casehistory, 'string');
  }
});

test('hash of an object equals the hash of its JSON string and is stable', () => {
  const expected = crypto.createHash('sha256').update(JSON.stringify(summary)).digest('hex');
  assert.equal(hashPayload(summary), expected);
  assert.equal(hashPayload(summary), hashPayload(JSON.stringify(summary)));
  assert.equal(hashPayload(summary), hashPayload({ ...summary }));
});
