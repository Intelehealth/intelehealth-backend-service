const moment = require("moment-timezone");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { database, openMrsDatabase } = require("../../database");
const { parseJsonArray } = require("../../config");

/*
  WebRTC recordings are written by the web-rtc service through LiveKit egress as
  <brand>/<domain>/<location>/recording-DD-MM-YYYY_HH:mm:ss.mp4, so the day a
  recording belongs to is carried by the key itself and the objects are split
  into one folder per location. S3 LastModified is the upload-completion time,
  which drifts past midnight for a call that spans it and changes if an object
  is ever copied, so the key timestamp is the authoritative signal. The
  last-modified strategy stays the fallback for buckets with no naming
  convention.
*/
const S3_KEY_TIMESTAMP_STRATEGY = "key-timestamp";
const S3_LAST_MODIFIED_STRATEGY = "last-modified";
const RECORDING_FILE_PREFIX = "recording-";
const RECORDING_DATE_FORMAT = "DD-MM-YYYY";
const RECORDING_TIME_FORMAT = "HH:mm:ss";
const S3_LIST_CONCURRENCY = 8;
const ROOT_FOLDER_LABEL = "(root)";
const BREAKDOWN_LIMIT = 6;

/*
  call_recordings stores start_time and end_time in UTC while the MySQL session
  runs in the deployment's local zone, so a CURDATE() comparison would attribute
  a late-night recording to the previous day. Metrics that need the report
  period bind :startUtc / :endUtc instead.
*/
const SQL_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

const DEFAULT_DATABASE_METRICS = [
  {
    name: "total_patients",
    label: "Patients registered today",
    section: "Patients & Visits",
    database: "openmrs",
    valueColumn: "total_patients",
    query: `SELECT COUNT(*) AS total_patients
      FROM patient
      WHERE voided = 0
        AND date_created >= :startLocal
        AND date_created < :endLocal`,
  },
  {
    name: "visits_with_prescription",
    label: "Visits with prescriptions today",
    section: "Patients & Visits",
    database: "openmrs",
    valueColumn: "total_visits_with_prescription",
    query: `SELECT COUNT(DISTINCT v.visit_id) AS total_visits_with_prescription
      FROM visit v
      JOIN person p ON p.person_id = v.patient_id AND p.voided = 0
      JOIN encounter e ON e.visit_id = v.visit_id AND e.voided = 0 AND e.encounter_type = 14
      WHERE v.voided = 0
        AND v.date_started >= :startLocal
        AND v.date_started < :endLocal`,
  },
  {
    name: "start_calls",
    label: "Start Call actions today",
    section: "Calls & Recordings",
    database: "portal",
    query: `SELECT COUNT(*) AS count
      FROM call_data
      WHERE createdAt >= :startUtc
        AND createdAt < :endUtc`,
  },
  {
    name: "recordings_started",
    label: "WebRTC recordings started today",
    section: "Calls & Recordings",
    database: "portal",
    query: `SELECT COUNT(*) AS count
      FROM call_recordings
      WHERE start_time >= :startUtc
        AND start_time < :endUtc`,
  },
  {
    name: "recordings_completed",
    label: "WebRTC recordings completed today",
    section: "Calls & Recordings",
    database: "portal",
    query: `SELECT COUNT(*) AS count
      FROM call_recordings
      WHERE start_time >= :startUtc
        AND start_time < :endUtc
        AND end_time IS NOT NULL`,
  },
  {
    name: "recordings_avg_duration",
    label: "Average recording length",
    section: "Calls & Recordings",
    database: "portal",
    unit: "s",
    query: `SELECT COALESCE(ROUND(AVG(TIMESTAMPDIFF(SECOND, start_time, end_time))), 0) AS count
      FROM call_recordings
      WHERE start_time >= :startUtc
        AND start_time < :endUtc
        AND end_time IS NOT NULL`,
  },
  {
    name: "recordings_under_30s",
    label: "Recordings under 30 seconds",
    section: "Calls & Recordings",
    database: "portal",
    query: `SELECT COUNT(*) AS count
      FROM call_recordings
      WHERE start_time >= :startUtc
        AND start_time < :endUtc
        AND end_time IS NOT NULL
        AND TIMESTAMPDIFF(SECOND, start_time, end_time) < 30`,
  },
  {
    name: "whatsapp_calls",
    label: "WhatsApp calls recorded today",
    section: "Calls & Recordings",
    database: "openmrs",
    query: `SELECT COUNT(*) AS count
      FROM visit_attribute va
      JOIN visit_attribute_type vat ON vat.visit_attribute_type_id = va.attribute_type_id
      JOIN JSON_TABLE(
        IF(JSON_VALID(va.value_reference), va.value_reference, '[]'),
        '$[*]' COLUMNS(call_timestamp BIGINT PATH '$.timestamp')
      ) calls
      WHERE va.voided = 0
        AND vat.uuid = '35e64f4a-d0a5-40bc-8010-8c61d52cc4b1'
        AND FROM_UNIXTIME(calls.call_timestamp / 1000) >= :startLocal
        AND FROM_UNIXTIME(calls.call_timestamp / 1000) < :endLocal`,
  },
];

/*
  Each recordings bucket must be named explicitly. Falling back to
  AWS_BUCKET_NAME would point an unconfigured metric at the documents bucket and
  report whatever was uploaded there as a recording count, which reads as a
  plausible number rather than as a misconfiguration.
*/
const defaultS3Metrics = () => [
  {
    name: "webrtc_recordings",
    label: "WebRTC recordings today",
    section: "Calls & Recordings",
    bucket: process.env.WEBRTC_RECORDINGS_S3_BUCKET,
    prefix: process.env.WEBRTC_RECORDINGS_S3_PREFIX || "",
    strategy: S3_KEY_TIMESTAMP_STRATEGY,
  },
  {
    name: "kaleyra_recordings",
    label: "Kaleyra recordings today",
    section: "Calls & Recordings",
    bucket: process.env.KALEYRA_RECORDINGS_S3_BUCKET,
    prefix: process.env.KALEYRA_RECORDINGS_S3_PREFIX || "",
    strategy: S3_LAST_MODIFIED_STRATEGY,
  },
].filter((metric) => Boolean(metric.bucket));

const validateMetrics = (metrics, fields) => metrics.map((metric) => {
  if (!metric || fields.some((field) => !metric[field])) {
    throw new Error(`Invalid metric; required fields: ${fields.join(", ")}`);
  }
  return metric;
});

const databaseMetrics = () => validateMetrics(
  parseJsonArray(process.env.DAILY_REPORT_DB_METRICS, DEFAULT_DATABASE_METRICS),
  ["name", "label", "query"]
);

const s3Metrics = () => validateMetrics(
  parseJsonArray(process.env.DAILY_REPORT_S3_METRICS, defaultS3Metrics()),
  ["name", "label", "bucket"]
);

const assertReadOnlyQuery = (statement) => {
  const normalized = statement.trim().toLowerCase();
  if (!normalized.startsWith("select ") || normalized.includes(";")) {
    throw new Error("Report metrics must contain one read-only SELECT query");
  }
};

const collectDatabaseMetrics = async (period, dependencies = {}) => {
  const databases = dependencies.databases || { portal: database, openmrs: openMrsDatabase };
  return Promise.all(databaseMetrics().map(async (metric) => {
    assertReadOnlyQuery(metric.query);
    const connection = databases[metric.database || "portal"];
    if (!connection) throw new Error(`Unknown database for metric ${metric.name}: ${metric.database}`);
    const [rows] = await connection.query(metric.query, {
      start: period.start.toDate(),
      end: period.end.toDate(),
      startUtc: period.start.clone().utc().format(SQL_DATETIME_FORMAT),
      endUtc: period.end.clone().utc().format(SQL_DATETIME_FORMAT),
      startLocal: period.start.clone().format(SQL_DATETIME_FORMAT),
      endLocal: period.end.clone().format(SQL_DATETIME_FORMAT),
    });
    const valueColumn = metric.valueColumn || "count";
    const value = Number(rows[0]?.[valueColumn]);
    if (!Number.isFinite(value)) throw new Error(`Metric ${metric.name} must return a count column`);
    return {
      name: metric.name,
      label: metric.label,
      section: metric.section || "Other",
      value,
      unit: metric.unit,
      source: metric.database === "openmrs" ? "OpenMRS DB" : "Portal DB",
    };
  }));
};

const normalizeFolderPrefix = (prefix) => {
  const value = prefix || "";
  return !value || value.endsWith("/") ? value : `${value}/`;
};

const mapWithConcurrency = async (items, limit, task) => {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
};

const listObjects = async ({ client, bucket, prefix, delimiter }) => {
  const contents = [];
  const folders = [];
  let continuationToken;

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || "",
      Delimiter: delimiter,
      ContinuationToken: continuationToken,
    }));
    contents.push(...(response.Contents || []));
    folders.push(...(response.CommonPrefixes || []).map(({ Prefix }) => Prefix).filter(Boolean));
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return { contents, folders };
};

const listLocationFolders = async ({ client, bucket, prefix }) => {
  const { folders } = await listObjects({ client, bucket, prefix, delimiter: "/" });
  return folders;
};

const parseKeyTimestamp = (key, { filePrefix, keyFormat, timezone }) => {
  const fileName = key.slice(key.lastIndexOf("/") + 1);
  if (!fileName.startsWith(filePrefix)) return null;
  const stamp = fileName.slice(filePrefix.length).replace(/\.[^.]+$/, "");
  const parsed = moment.tz(stamp, keyFormat, true, timezone);
  return parsed.isValid() ? parsed : null;
};

const periodDays = ({ start, end, timezone, dateFormat }) => {
  const days = [];
  const cursor = moment.tz(start, timezone).startOf("day");
  const last = moment.tz(end, timezone);
  while (cursor.isSameOrBefore(last, "day")) {
    days.push(cursor.format(dateFormat));
    cursor.add(1, "day");
  }
  return days;
};

/*
  Recordings are not partitioned by date in S3, so a full prefix scan would grow
  with the lifetime of the bucket. Listing the location folders once and then
  listing "<location>/recording-<day>_" turns each report into a handful of
  narrow, day-scoped listings instead.
*/
const countRecordingsByKeyTimestamp = async ({
  client,
  bucket,
  prefix,
  start,
  end,
  timezone,
  filePrefix = RECORDING_FILE_PREFIX,
  dateFormat = RECORDING_DATE_FORMAT,
  timeFormat = RECORDING_TIME_FORMAT,
}) => {
  const base = normalizeFolderPrefix(prefix);
  const keyFormat = `${dateFormat}_${timeFormat}`;
  const folders = [base, ...await listLocationFolders({ client, bucket, prefix: base })];
  const days = periodDays({ start, end, timezone, dateFormat });
  const probes = folders.flatMap((folder) => days.map((day) => ({ folder, day })));

  const counted = await mapWithConcurrency(probes, S3_LIST_CONCURRENCY, async ({ folder, day }) => {
    const { contents } = await listObjects({
      client,
      bucket,
      prefix: `${folder}${filePrefix}${day}_`,
    });
    const matched = contents.filter(({ Key }) => {
      if (!Key || Key.endsWith("/")) return false;
      const recordedAt = parseKeyTimestamp(Key, { filePrefix, keyFormat, timezone });
      return recordedAt != null
        && recordedAt.valueOf() >= start.getTime()
        && recordedAt.valueOf() < end.getTime();
    });
    return { folder, count: matched.length };
  });

  const breakdown = {};
  let count = 0;
  for (const entry of counted) {
    count += entry.count;
    if (!entry.count) continue;
    const location = entry.folder === base
      ? ROOT_FOLDER_LABEL
      : entry.folder.slice(base.length).replace(/\/$/, "");
    breakdown[location] = (breakdown[location] || 0) + entry.count;
  }

  return { count, breakdown };
};

const countS3Objects = async ({ client, bucket, prefix, start, end }) => {
  const { contents } = await listObjects({ client, bucket, prefix });
  return contents.filter(({ LastModified }) => LastModified >= start && LastModified < end).length;
};

const describeBreakdown = (breakdown, limit = BREAKDOWN_LIMIT) => {
  const entries = Object.entries(breakdown).sort(([, left], [, right]) => right - left);
  if (!entries.length) return null;
  const shown = entries.slice(0, limit).map(([location, total]) => `${location} ${total}`);
  const remainder = entries.length - shown.length;
  return remainder > 0 ? `${shown.join(" · ")} · +${remainder} more` : shown.join(" · ");
};

const collectS3Metric = async (metric, period, client) => {
  const start = period.start.toDate();
  const end = period.end.toDate();
  const collected = {
    name: metric.name,
    label: metric.label,
    section: metric.section || "Calls & Recordings",
    source: "S3",
  };

  if ((metric.strategy || S3_LAST_MODIFIED_STRATEGY) !== S3_KEY_TIMESTAMP_STRATEGY) {
    return {
      ...collected,
      value: await countS3Objects({ client, bucket: metric.bucket, prefix: metric.prefix, start, end }),
    };
  }

  const { count, breakdown } = await countRecordingsByKeyTimestamp({
    client,
    bucket: metric.bucket,
    prefix: metric.prefix,
    start,
    end,
    timezone: metric.keyTimezone || period.timezone || process.env.CRON_TIMEZONE || "UTC",
    filePrefix: metric.filePrefix || RECORDING_FILE_PREFIX,
    dateFormat: metric.keyDateFormat || RECORDING_DATE_FORMAT,
    timeFormat: metric.keyTimeFormat || RECORDING_TIME_FORMAT,
  });

  return { ...collected, value: count, breakdown, detail: describeBreakdown(breakdown) };
};

const collectS3Metrics = async (period, dependencies = {}) => {
  const client = dependencies.s3Client || new S3Client({ region: process.env.AWS_REGION });
  return Promise.all(s3Metrics().map((metric) => collectS3Metric(metric, period, client)));
};

module.exports = {
  DEFAULT_DATABASE_METRICS,
  defaultS3Metrics,
  collectDatabaseMetrics,
  describeBreakdown,
  collectS3Metrics,
  countS3Objects,
  countRecordingsByKeyTimestamp,
  listLocationFolders,
  parseKeyTimestamp,
  assertReadOnlyQuery,
  RECORDING_FILE_PREFIX,
  RECORDING_DATE_FORMAT,
  RECORDING_TIME_FORMAT,
};
