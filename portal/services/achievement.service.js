"use strict";
const { QueryTypes, Op } = require("sequelize");
const {
  PROVIDER_ATTRIBUTE_TYPE_UUID,
  CREATED_DATE_ATTRIBUTE_TYPE_UUID,
  INITIAL_ENCOUNTER_TYPE_UUID,
  VISIT_COMPLETE_ENCOUNTER_TYPE_UUID,
  PATIENT_EXIT_SURVEY_ENCOUNTER_TYPE_UUID,
  SECONDS_PER_DAY,
  PROVISIONAL_FIELDS,
  MAX_RECENT_REQUESTS,
} = require("../constants/achievement.constant");
const { MESSAGE } = require("../constants/messages");
const { getConfig, todayInOffset, addDays, toIsoDate } = require("./achievement-validation");
const { parseIntervals, formatIntervals, totalSeconds, addInterval } = require("./activity-intervals");

/**
 * Error carrying the HTTP status the controller should answer with.
 */
class HttpError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HttpError";
    this.code = code;
  }
}

// Several heartbeats creating or locking the same day's row at the same moment can make InnoDB pick one
// of them as a deadlock victim. Its transaction was rolled back, so nothing was written and it is safe to
// run again.
const MAX_HEARTBEAT_ATTEMPTS = 3;
const isDeadlock = (error) =>
  Boolean(error) &&
  ((error.parent && error.parent.code === "ER_LOCK_DEADLOCK") ||
    (error.original && error.original.code === "ER_LOCK_DEADLOCK"));

// The provider behind an OpenMRS user hardly ever changes, and every heartbeat and summary
// needs it, so it is kept in memory for a minute: long enough to spare the lookup on a burst of
// requests, short enough that a provider who is retired is refused soon after. Only found providers are
// kept, so a user who is linked to a provider later is not turned away for the length of the cache.
const PROVIDER_CACHE_TTL_MS = 60 * 1000;
const PROVIDER_CACHE_MAX_ENTRIES = 5000;

// The number of open visits waiting for the doctor is not shown on the dashboard, so it is
// counted at most once a minute per provider.
const PENDING_VISITS_TTL_MS = 60 * 1000;

// The counts of doctor visits and registered patients need long queries, and a dashboard is opened and
// refreshed often, so each is kept for a minute per provider and date range (see cachedCount).
const COUNTS_TTL_MS = 60 * 1000;

// A heartbeat is a claim: "I was working during the `seconds` seconds that ended at `endedAt`".
// The time already counted for a provider and IST day is kept as a list of intervals (see
// activity-intervals.js). The claim is added to that list, and the day's seconds are the total length
// of the list, so the same time reported twice (two tabs, two devices), or pieces that arrive in any
// order (a backlog sent newest first, a phone that reconnects after a desktop already reported later
// time), are all counted once and none is lost. Holds no user input: values are bound.
// The statements run in one transaction. The day's row is created first if it is missing, then locked
// (FOR UPDATE), so heartbeats of the same provider and day add their intervals one after the other
// and none overwrites another's.
// A request can carry an id (`:requestId`, NULL without one). The row remembers the CRC32 of the ids of
// the last MAX_RECENT_REQUESTS requests that had one, and a request with one of those ids again is a
// replay of it (a client or proxy that sends it a second time after a lost answer): it adds nothing.
// Without that, a replay would count as a claim about a later period, because the period's end is worked
// out from the time the request arrives. Several ids are kept, not one, so a replay is still recognised
// when another device has sent a request of its own in between.
// The row is (provider_uuid, activity_date) and its numbers, nothing else: see
// migrations/20261027120000-create-user-activity.js.
const ENSURE_ROW_SQL = `
  INSERT INTO user_activity (provider_uuid, activity_date, active_seconds, covered_intervals, recent_request_crcs)
  VALUES (:providerUuid, :activityDate, 0, '', '')
  ON DUPLICATE KEY UPDATE provider_uuid = provider_uuid`;
const LOCK_ROW_SQL = `
  SELECT active_seconds, covered_intervals, recent_request_crcs, CRC32(:requestId) AS request_crc
  FROM user_activity
  WHERE provider_uuid = :providerUuid AND activity_date = :activityDate
  FOR UPDATE`;
const SAVE_ROW_SQL = `
  UPDATE user_activity
  SET active_seconds = :activeSeconds,
      covered_intervals = :intervals,
      recent_request_crcs = :recentRequestCrcs
  WHERE provider_uuid = :providerUuid AND activity_date = :activityDate`;
// No date limit: everything up to now.
const ALL_TIME = { from: null, to: null };

// Finds the provider linked to the OpenMRS user in the login token.
// If one user has several providers, the lowest provider_id is used.
const PROVIDER_SQL = `
  SELECT p.uuid AS provider_uuid
  FROM users u
  JOIN provider p ON p.person_id = u.person_id AND p.retired = 0
  WHERE u.uuid = :userUuid
  ORDER BY p.provider_id
  LIMIT 1`;

// Who registered a patient. The providerUUID tag on the patient wins. A patient with no tag at all
// (for example one registered in the new webapp, which does not write it) belongs to the provider
// of the user who created the patient record (patient.creator), but only once the patient has had a
// visit: a shared or system account that bulk-creates records would otherwise be credited with
// thousands of patients nobody has seen. The visit is checked with EXISTS, so a patient with many
// visits is still one patient. A user with several providers counts for the lowest provider_id, as in
// PROVIDER_SQL. Only real patients count: a person needs a row in the patient table. Other person
// records that carry the tag (for example registrations that were never completed) are left out.
// Holds no user input: values are bound.

// The users whose patients belong to the provider. Looked up first and bound as a list: MySQL
// picks a much slower plan when this is a subquery inside the patient query.
// It starts from the one provider row (found by uuid) and keeps it only when it is the lowest
// non-retired provider_id of its person, then takes that person's users. Starting from every user and
// checking each one's providers returned the same ids, but read every row of users on each call.
const CREATOR_USERS_SQL = `
  SELECT cu.user_id AS user_id
  FROM provider cp
  JOIN users cu ON cu.person_id = cp.person_id
  WHERE cp.uuid = :providerUuid
    AND cp.retired = 0
    AND cp.provider_id = (
          SELECT MIN(x.provider_id) FROM provider x
          WHERE x.person_id = cp.person_id AND x.retired = 0)`;

// A patient that carries some provider tag, whoever it names. An empty tag is no tag.
const HAS_PROVIDER_TAG = `
        EXISTS (
          SELECT 1
          FROM person_attribute tg
          JOIN person_attribute_type tgt
            ON tgt.person_attribute_type_id = tg.person_attribute_type_id
           AND tgt.uuid = :providerAttributeType
          WHERE tg.person_id = p2.patient_id AND tg.voided = 0 AND tg.value <> '')`;

// The created-date attribute when there is one, else the day the patient record was created.
const CREATED_VALUE_SQL = "COALESCE(created.value, DATE_FORMAT(p.date_created, '%Y-%m-%d'))";

// The date of that value, for the two ways the apps write it: "2026-10-27" and "27 October, 2026".
// Anything else is NULL here and is read in JavaScript (toIsoDate), which knows more ways.
const CREATED_DATE_SQL = `
  CASE
    WHEN ${CREATED_VALUE_SQL} REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      THEN STR_TO_DATE(LEFT(${CREATED_VALUE_SQL}, 10), '%Y-%m-%d')
    WHEN ${CREATED_VALUE_SQL} REGEXP '^[0-9]{1,2} [A-Za-z]+, [0-9]{4}$'
      THEN STR_TO_DATE(${CREATED_VALUE_SQL}, '%d %M, %Y')
  END`;

// The patients of the provider, one row each (plus one more for a patient with two created-date
// attributes). The counting is done in SQL, so no row per patient travels to the portal.
// The first branch of the UNION finds the patients tagged with the provider by reading every
// providerUUID attribute row (person_attribute has an index on the attribute type but none on value),
// so its cost grows with the number of such rows in the whole database, not with this provider's
// patients (EXPLAIN ANALYZE on a database of 30k patients: 3,411 rows read for 1,861 patients, about
// 3 ms). If that becomes slow, the fix is an index on the OpenMRS database, which this service only
// reads, so it has to be added there by whoever runs it:
//   CREATE INDEX person_attribute_type_value_idx ON person_attribute (person_attribute_type_id, value);
const BENEFICIARY_FROM = `
  FROM (
    SELECT pa.person_id AS person_id
    FROM person_attribute pa
    JOIN person_attribute_type pat
      ON pat.person_attribute_type_id = pa.person_attribute_type_id
     AND pat.uuid = :providerAttributeType
    WHERE pa.voided = 0 AND pa.value = :providerUuid
    UNION
    SELECT p2.patient_id AS person_id
    FROM patient p2
    WHERE p2.creator IN (:creatorUserIds)
      AND EXISTS (SELECT 1 FROM visit pv WHERE pv.patient_id = p2.patient_id AND pv.voided = 0)
      AND NOT ${HAS_PROVIDER_TAG}
  ) t
  JOIN patient p ON p.patient_id = t.person_id AND p.voided = 0
  JOIN person per ON per.person_id = p.patient_id AND per.voided = 0
  LEFT JOIN person_attribute created
    ON created.person_id = p.patient_id
   AND created.voided = 0
   AND created.person_attribute_type_id = (
         SELECT person_attribute_type_id FROM person_attribute_type
         WHERE uuid = :createdDateAttributeType LIMIT 1)`;

// How many patients the provider registered, and how many of them in the range, for the values
// the SQL can read. `unread` is how many have a value it cannot read.
const BENEFICIARY_COUNT_SQL = `
  SELECT COUNT(DISTINCT t.person_id) AS total,
         COUNT(DISTINCT CASE WHEN ${CREATED_DATE_SQL} BETWEEN :rangeFrom AND :rangeTo
                             THEN t.person_id END) AS in_range,
         COUNT(DISTINCT CASE WHEN ${CREATED_DATE_SQL} IS NULL THEN t.person_id END) AS unread
  ${BENEFICIARY_FROM}`;

// The patients whose created-date value the SQL cannot read, for JavaScript to read.
const BENEFICIARY_UNREAD_SQL = `
  SELECT t.person_id AS person_id, ${CREATED_VALUE_SQL} AS created_value
  ${BENEFICIARY_FROM}
  WHERE ${CREATED_DATE_SQL} IS NULL`;
// OpenMRS keeps the provider on each encounter (encounter_provider), not on the visit and not on the
// patient. A visit counts as this provider's when the provider recorded its initial (ADULTINITIAL)
// encounter, so a visit belongs to one nurse only, even when another nurse later adds an encounter.
// The visit column to match is picked by key from a fixed list, so no text from a caller (and none from
// a request) is ever put into the statement as an identifier. An unknown key throws.
const VISIT_COLUMNS = Object.freeze({
  visit: "v.visit_id",
});
const recordedByProvider = (visitKey) => {
  if (!Object.prototype.hasOwnProperty.call(VISIT_COLUMNS, visitKey)) {
    throw new Error(`Unknown visit column key: ${visitKey}`);
  }
  return `
    EXISTS (
      SELECT 1
      FROM encounter mine
      JOIN encounter_type mt ON mt.encounter_type_id = mine.encounter_type AND mt.uuid = :initialType
      JOIN encounter_provider ep ON ep.encounter_id = mine.encounter_id AND ep.voided = 0
      JOIN provider mp ON mp.provider_id = ep.provider_id AND mp.uuid = :providerUuid
      WHERE mine.visit_id = ${VISIT_COLUMNS[visitKey]} AND mine.voided = 0)`;
};

// Visits with a Visit Complete encounter whose initial encounter the provider recorded.
// The query starts from the provider: provider -> their encounters -> their initial (ADULTINITIAL)
// encounters -> the visits, and only then asks whether such a visit has a Visit Complete encounter
// (in the range, when there is one). It does not read every Visit Complete encounter in the database.
// The date clause is only added for a range. It holds no user input.
const doctorVisitsSql = (withRange) => `
  SELECT COUNT(DISTINCT v.visit_id) AS total
  FROM provider mp
  JOIN encounter_provider ep ON ep.provider_id = mp.provider_id AND ep.voided = 0
  JOIN encounter mine ON mine.encounter_id = ep.encounter_id AND mine.voided = 0
  JOIN encounter_type mt ON mt.encounter_type_id = mine.encounter_type AND mt.uuid = :initialType
  JOIN visit v ON v.visit_id = mine.visit_id AND v.voided = 0
  WHERE mp.uuid = :providerUuid
    AND EXISTS (
      SELECT 1
      FROM encounter e
      JOIN encounter_type et ON et.encounter_type_id = e.encounter_type AND et.uuid = :visitCompleteType
      WHERE e.visit_id = v.visit_id
        AND e.voided = 0
        ${withRange ? "AND e.encounter_datetime >= :rangeStart AND e.encounter_datetime < :rangeEnd" : ""})`;

// Visits still waiting for the doctor: open, started by the provider, and with no
// Visit Complete or Patient Exit Survey encounter yet. Holds no user input.
const VISITS_PENDING_SQL = `
  SELECT COUNT(DISTINCT v.visit_id) AS total
  FROM visit v
  WHERE v.voided = 0
    AND v.date_stopped IS NULL
    AND ${recordedByProvider("visit")}
    AND NOT EXISTS (
      SELECT 1
      FROM encounter e
      JOIN encounter_type et ON et.encounter_type_id = e.encounter_type
      WHERE e.visit_id = v.visit_id
        AND e.voided = 0
        AND et.uuid IN (:finishedTypes))`;

/**
 * Build the achievement service. Everything it talks to is passed in so it can
 * be tested without a database.
 * @param {object} deps
 * @param {object} deps.openmrs - Sequelize instance for the OpenMRS database (read only)
 * @param {object} deps.userActivity - user_activity model
 * @param {object} deps.sequelize - Sequelize instance for the portal database
 * @param {() => Date} [deps.now]
 * @param {() => object} [deps.getSettings]
 * @param {(ms: number) => Promise<void>} [deps.sleep] - the wait between two attempts at a deadlocked heartbeat
 * @param {number} [deps.providerCacheTtlMs] - how long a found provider is kept in memory, 0 to turn it off
 * @param {number} [deps.pendingVisitsTtlMs] - how long a provider's count of visits waiting for the doctor is kept, 0 to turn it off
 * @param {number} [deps.countsTtlMs] - how long a provider's doctor-visit and beneficiary counts are kept, 0 to turn it off
 */
const createAchievementService = ({
  openmrs,
  userActivity,
  sequelize,
  now = () => new Date(),
  getSettings = getConfig,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  providerCacheTtlMs = PROVIDER_CACHE_TTL_MS,
  pendingVisitsTtlMs = PENDING_VISITS_TTL_MS,
  countsTtlMs = COUNTS_TTL_MS,
}) => {
  /**
   * The provider UUID for the OpenMRS user in the token.
   * @param {string} userUuid
   */
  const providerCache = new Map();
  const resolveProviderUuid = async (userUuid) => {
    const time = now().getTime();
    const cached = providerCache.get(userUuid);
    if (cached && cached.expiresAt > time) return cached.providerUuid;

    const rows = await openmrs.query(PROVIDER_SQL, {
      replacements: { userUuid },
      type: QueryTypes.SELECT,
    });
    if (!rows || rows.length === 0) {
      throw new HttpError(403, MESSAGE.ACHIEVEMENT.PROVIDER_NOT_LINKED);
    }
    const providerUuid = rows[0].provider_uuid;
    if (providerCacheTtlMs > 0) {
      if (providerCache.size >= PROVIDER_CACHE_MAX_ENTRIES) providerCache.clear();
      providerCache.set(userUuid, { providerUuid, expiresAt: time + providerCacheTtlMs });
    }
    return providerUuid;
  };

  const countBeneficiaries = async (providerUuid, range) => {
    const creators = await openmrs.query(CREATOR_USERS_SQL, {
      replacements: { providerUuid },
      type: QueryTypes.SELECT,
    });
    // -1 matches no patient, so the list is never empty
    const creatorUserIds = creators && creators.length > 0 ? creators.map((c) => c.user_id) : [-1];
    const replacements = {
      providerUuid,
      providerAttributeType: PROVIDER_ATTRIBUTE_TYPE_UUID,
      createdDateAttributeType: CREATED_DATE_ATTRIBUTE_TYPE_UUID,
      creatorUserIds,
      rangeFrom: range.from === null ? "1000-01-01" : range.from,
      rangeTo: range.to === null ? "9999-12-31" : range.to,
    };
    // One query counts every patient this provider has registered up to now and the ones created in the
    // range. Only a patient whose created-date value the SQL cannot read is fetched, to be read here.
    const counted = await openmrs.query(BENEFICIARY_COUNT_SQL, { replacements, type: QueryTypes.SELECT });
    const counts = (counted && counted[0]) || {};
    const total = Number(counts.total) || 0;
    if (range.from === null) return { inRange: total, total, unreadable: 0 };

    let inRange = Number(counts.in_range) || 0;
    // Patients whose created date is in no format that is known (see toIsoDate). They are left out of
    // the range count, so they are counted here and reported in meta, not dropped silently.
    const unreadable = new Set();
    if (Number(counts.unread) > 0) {
      const rows = await openmrs.query(BENEFICIARY_UNREAD_SQL, { replacements, type: QueryTypes.SELECT });
      const read = new Set();
      for (const row of rows || []) {
        const created = toIsoDate(row.created_value);
        if (!created) unreadable.add(row.person_id);
        else if (created >= range.from && created <= range.to) read.add(row.person_id);
      }
      inRange += read.size;
    }
    return { inRange, total, unreadable: unreadable.size };
  };

  const countDoctorVisits = async (providerUuid, range) => {
    const withRange = range.from !== null;
    const replacements = {
      providerUuid,
      initialType: INITIAL_ENCOUNTER_TYPE_UUID,
      visitCompleteType: VISIT_COMPLETE_ENCOUNTER_TYPE_UUID,
    };
    if (withRange) {
      // OpenMRS stores encounter_datetime in IST (confirmed), the same zone the dates here are worked out in,
      // so they are compared as stored, with no timezone conversion. If the OpenMRS server is ever moved
      // to another zone, convert rangeStart and rangeEnd here.
      replacements.rangeStart = `${range.from} 00:00:00`;
      replacements.rangeEnd = `${addDays(range.to, 1)} 00:00:00`;
    }
    const rows = await openmrs.query(doctorVisitsSql(withRange), {
      replacements,
      type: QueryTypes.SELECT,
    });
    return Number(rows && rows[0] && rows[0].total) || 0;
  };

  // The dashboard does not show this number, so it is kept for a short time per provider, not counted
  // again for every request.
  const pendingVisits = new Map();
  const countVisitsPending = async (providerUuid) => {
    const time = now().getTime();
    const cached = pendingVisits.get(providerUuid);
    if (cached && cached.expiresAt > time) return cached.count;

    const rows = await openmrs.query(VISITS_PENDING_SQL, {
      replacements: {
        providerUuid,
        initialType: INITIAL_ENCOUNTER_TYPE_UUID,
        finishedTypes: [
          VISIT_COMPLETE_ENCOUNTER_TYPE_UUID,
          PATIENT_EXIT_SURVEY_ENCOUNTER_TYPE_UUID,
        ],
      },
      type: QueryTypes.SELECT,
    });
    const count = Number(rows && rows[0] && rows[0].total) || 0;
    if (pendingVisitsTtlMs > 0) {
      if (pendingVisits.size >= PROVIDER_CACHE_MAX_ENTRIES) pendingVisits.clear();
      pendingVisits.set(providerUuid, { count, expiresAt: time + pendingVisitsTtlMs });
    }
    return count;
  };

  // Counts that need a long query are kept for countsTtlMs under a key naming the provider and the dates.
  const counts = new Map();
  const cachedCount = async (key, compute) => {
    const time = now().getTime();
    const cached = counts.get(key);
    if (cached && cached.expiresAt > time) return cached.value;

    const value = await compute();
    if (countsTtlMs > 0) {
      if (counts.size >= PROVIDER_CACHE_MAX_ENTRIES) counts.clear();
      counts.set(key, { value, expiresAt: time + countsTtlMs });
    }
    return value;
  };

  // Time spent in the range: the total, the days with any activity, and their average.
  // Days with no activity are not part of the average, so a week off does not pull it down.
  // The average that is returned is always the all-time one (see getSummary).
  const timeSpent = async (providerUuid, range) => {
    const where = { provider_uuid: providerUuid };
    if (range.from !== null) {
      where.activity_date = { [Op.between]: [range.from, range.to] };
    }
    const [total, activeDays] = await Promise.all([
      userActivity.sum("active_seconds", { where }),
      userActivity.count({ where: { ...where, active_seconds: { [Op.gt]: 0 } } }),
    ]);
    const seconds = Number(total) || 0;
    const days = Number(activeDays) || 0;
    return { seconds, activeDays: days, averageSeconds: days > 0 ? Math.round(seconds / days) : 0 };
  };

  const isActiveToday = async (providerUuid) => {
    const { tzOffsetMinutes } = getSettings();
    const row = await userActivity.findOne({
      attributes: ["active_seconds"],
      where: { provider_uuid: providerUuid, activity_date: todayInOffset(now(), tzOffsetMinutes) },
    });
    return Boolean(row && row.active_seconds > 0);
  };

  /**
   * Values for the Achievements panel.
   * @param {{ userUuid: string, range: { from: string|null, to: string|null } }} input
   */
  const getSummary = async ({ userUuid, range }) => {
    const providerUuid = await resolveProviderUuid(userUuid);

    // The all-time totals do not depend on the dates asked for. For an all-time
    // request the range count is already the total, so it is not counted twice.
    const visitsFor = (dates) =>
      cachedCount(`visits|${providerUuid}|${dates.from}|${dates.to}`, () => countDoctorVisits(providerUuid, dates));
    const doctorVisitsInRange = visitsFor(range);
    const doctorVisitsTotal = range.from === null ? doctorVisitsInRange : visitsFor(ALL_TIME);

    // The average covers every day with activity up to now, past days included, whatever dates
    // were asked for. For an all-time request the range numbers already are those, so they are
    // not read twice.
    const timeSpentInRangePromise = timeSpent(providerUuid, range);
    const timeSpentAllTime =
      range.from === null ? timeSpentInRangePromise : timeSpent(providerUuid, ALL_TIME);

    const [
      beneficiaries,
      doctorVisits,
      doctorVisitsCompletedTotal,
      visitsPendingFromDoctor,
      timeSpentInRange,
      timeSpentOverall,
      active,
    ] = await Promise.all([
      cachedCount(`beneficiaries|${providerUuid}|${range.from}|${range.to}`, () =>
        countBeneficiaries(providerUuid, range)
      ),
      doctorVisitsInRange,
      doctorVisitsTotal,
      countVisitsPending(providerUuid),
      timeSpentInRangePromise,
      timeSpentAllTime,
      isActiveToday(providerUuid),
    ]);

    return {
      from: range.from,
      to: range.to,
      // These three hold the totals for the dates asked for (today when none were sent).
      doctorVisitsInRange: doctorVisits,
      beneficiariesRegisteredInRange: beneficiaries.inRange,
      timeSpentSecondsInRange: timeSpentInRange.seconds,
      doctorVisitsCompletedTotal,
      visitsPendingFromDoctor,
      beneficiariesRegisteredTotal: beneficiaries.total,
      averageDailyTimeSpentSeconds: timeSpentOverall.averageSeconds,
      activeDaysCount: timeSpentOverall.activeDays,
      status: active ? "Active" : "Inactive",
      meta: {
        provisional: [...PROVISIONAL_FIELDS],
        // Patients registered by this provider whose created date could not be read, so they are not
        // in beneficiariesRegisteredInRange for a date range. Always 0 for period=overall.
        unreadableCreatedDates: beneficiaries.unreadable,
      },
    };
  };

  /**
   * Add the time a provider spent working. The beat claims the `activeSeconds` that ended
   * `endedSecondsAgo` seconds ago (0 for a beat sent as soon as its period ends). The period is added to
   * the intervals already counted for that provider, so time reported twice (two tabs or two devices),
   * or pieces that arrive in any order, are counted once and none is lost. The time is saved under the
   * IST day it happened in: a period that crosses IST midnight is split there, so each day gets only its
   * own part.
   * `todaySeconds` is the day's total, read after the write. A request with the same `requestId` as the
   * last one that had one is a replay: it adds nothing.
   * @param {{ userUuid: string, activeSeconds: number, endedSecondsAgo?: number, requestId?: string }} input
   */
  const recordHeartbeat = async ({ userUuid, activeSeconds, endedSecondsAgo = 0, requestId = null }) => {
    const providerUuid = await resolveProviderUuid(userUuid);
    const current = now();
    const endedAt = new Date(current.getTime() - endedSecondsAgo * 1000);
    const { tzOffsetMinutes } = getSettings();
    const activityDate = todayInOffset(endedAt, tzOffsetMinutes);

    // The part of the period after IST midnight belongs to this day, the part before it to the day
    // before. A period is at most an hour, so it crosses at most one midnight. Both rows get the same
    // requestId, so a replay of the whole request adds nothing to either. Times are whole seconds since
    // the start of the IST day (0..86400).
    const dayStartSeconds = Date.parse(`${activityDate}T00:00:00Z`) / 1000 - tzOffsetMinutes * 60;
    const endOffset = Math.floor(endedAt.getTime() / 1000) - dayStartSeconds;
    const todayPart = Math.min(activeSeconds, endOffset);
    const earlierPart = activeSeconds - todayPart;

    const addToDay = async (date, start, end) => {
      for (let attempt = 1; ; attempt += 1) {
        try {
          await sequelize.transaction(async (transaction) => {
            const replacements = { providerUuid, activityDate: date, requestId };
            await sequelize.query(ENSURE_ROW_SQL, { replacements, type: QueryTypes.INSERT, transaction });
            const [row] = await sequelize.query(LOCK_ROW_SQL, { replacements, type: QueryTypes.SELECT, transaction });
            const recent = String(row.recent_request_crcs || "").split(",").filter(Boolean);
            const crc = row.request_crc === null || row.request_crc === undefined ? null : String(row.request_crc);
            if (requestId !== null && crc !== null && recent.includes(crc)) return; // a replay

            const intervals = addInterval(parseIntervals(row.covered_intervals), start, end);
            await sequelize.query(SAVE_ROW_SQL, {
              replacements: {
                ...replacements,
                activeSeconds: Math.min(totalSeconds(intervals), SECONDS_PER_DAY),
                intervals: formatIntervals(intervals),
                recentRequestCrcs: (crc === null ? recent : [...recent, crc]).slice(-MAX_RECENT_REQUESTS).join(","),
              },
              type: QueryTypes.UPDATE,
              transaction,
            });
          });
          return;
        } catch (error) {
          if (attempt >= MAX_HEARTBEAT_ATTEMPTS || !isDeadlock(error)) throw error;
          // A short, growing and random wait, so the beats that deadlocked do not collide again.
          await sleep(10 * attempt + Math.floor(Math.random() * 50));
        }
      }
    };
    if (earlierPart > 0) await addToDay(addDays(activityDate, -1), SECONDS_PER_DAY - earlierPart, SECONDS_PER_DAY);
    if (todayPart > 0) await addToDay(activityDate, endOffset - todayPart, endOffset);

    const row = await userActivity.findOne({
      attributes: ["active_seconds"],
      where: { provider_uuid: providerUuid, activity_date: activityDate },
    });
    const todaySeconds = row ? row.active_seconds : Math.min(todayPart, SECONDS_PER_DAY);
    return { activityDate, todaySeconds };
  };
  return { resolveProviderUuid, getSummary, recordHeartbeat };
};

let defaultService = null;

/**
 * The service wired to the real databases. Created on first use so that
 * loading this file does not load the database models.
 */
const getAchievementService = () => {
  if (!defaultService) {
    const openmrs = require("../openmrs_models").sequelize;
    const { user_activity, sequelize } = require("../models");
    defaultService = createAchievementService({
      openmrs,
      userActivity: user_activity,
      sequelize,
    });
  }
  return defaultService;
};

module.exports = { HttpError, createAchievementService, getAchievementService };
