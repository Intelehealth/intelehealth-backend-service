const test = require("node:test");
const assert = require("node:assert/strict");
const moment = require("moment-timezone");
const {
  assertReadOnlyQuery,
  collectDatabaseMetrics,
  countS3Objects,
  collectS3Metrics,
  countRecordingsByKeyTimestamp,
  parseKeyTimestamp,
  describeBreakdown,
} = require("../crons/services/report-metrics.service");

test("accepts only one read-only database query", () => {
  assert.doesNotThrow(() => assertReadOnlyQuery("SELECT COUNT(*) AS count FROM visits"));
  assert.throws(() => assertReadOnlyQuery("DELETE FROM visits"), /read-only/);
  assert.throws(() => assertReadOnlyQuery("SELECT 1; DELETE FROM visits"), /read-only/);
});

test("counts S3 objects for the reporting period across pages", async () => {
  const pages = [
    {
      Contents: [
        { LastModified: new Date("2026-09-01T01:00:00.000Z") },
        { LastModified: new Date("2026-08-31T23:59:59.000Z") },
      ],
      IsTruncated: true,
      NextContinuationToken: "next",
    },
    {
      Contents: [{ LastModified: new Date("2026-09-01T22:00:00.000Z") }],
      IsTruncated: false,
    },
  ];
  const requests = [];
  const client = {
    send: async (command) => {
      requests.push(command.input);
      return pages.shift();
    },
  };

  const count = await countS3Objects({
    client,
    bucket: "reports",
    prefix: "temp_storage_",
    start: new Date("2026-09-01T00:00:00.000Z"),
    end: new Date("2026-09-02T00:00:00.000Z"),
  });

  assert.equal(count, 2);
  assert.equal(requests[1].ContinuationToken, "next");
});

test("collects patient and visit metrics from OpenMRS and call metrics from portal", async () => {
  const priorConfiguration = process.env.DAILY_REPORT_DB_METRICS;
  delete process.env.DAILY_REPORT_DB_METRICS;
  const queries = [];
  const query = (source) => async (statement, replacements) => {
    if (statement.includes("offset_seconds")) return [[{ offset_seconds: 19800 }]];
    queries.push({ source, statement, replacements });
    if (statement.includes("AS total_patients")) return [[{ total_patients: 500 }]];
    if (statement.includes("AS total_visits_with_prescription")) {
      return [[{ total_visits_with_prescription: 42 }]];
    }
    return [[{ count: source === "portal" ? 18 : 11 }]];
  };
  const period = {
    start: moment.utc("2026-09-01T00:00:00.000Z"),
    end: moment.utc("2026-09-02T00:00:00.000Z"),
  };

  try {
    const metrics = await collectDatabaseMetrics(period, {
      databases: {
        portal: { query: query("portal") },
        openmrs: { query: query("openmrs") },
      },
    });
    assert.deepEqual(metrics.map(({ name, value }) => [name, value]), [
      ["total_patients", 500],
      ["visits_with_prescription", 42],
      ["start_calls", 18],
      ["recordings_started", 18],
      ["recordings_completed", 18],
      ["recordings_avg_duration", 18],
      ["recordings_under_30s", 18],
      ["whatsapp_calls", 11],
    ]);
    assert.equal(queries.filter(({ source }) => source === "openmrs").length, 3);
    assert.equal(queries.filter(({ source }) => source === "portal").length, 5);
  } finally {
    if (priorConfiguration == null) delete process.env.DAILY_REPORT_DB_METRICS;
    else process.env.DAILY_REPORT_DB_METRICS = priorConfiguration;
  }
});

test("parses the recording timestamp encoded in the object key", () => {
  const options = { filePrefix: "recording-", keyFormat: "DD-MM-YYYY_HH:mm:ss", timezone: "Asia/Kolkata" };
  const parsed = parseKeyTimestamp("IDA/dev.intelehealth.org/Bhopal/recording-01-09-2026_14:30:12.mp4", options);

  assert.equal(parsed.toISOString(), "2026-09-01T09:00:12.000Z");
  assert.equal(parseKeyTimestamp("IDA/dev.intelehealth.org/Bhopal/", options), null);
  assert.equal(parseKeyTimestamp("IDA/dev.intelehealth.org/Bhopal/other-01-09-2026_14:30:12.mp4", options), null);
  assert.equal(parseKeyTimestamp("IDA/dev.intelehealth.org/Bhopal/recording-not-a-date.mp4", options), null);
});

test("counts recordings per location using the day-scoped key prefix", async () => {
  const objects = {
    "IDA/dev/Bhopal/recording-01-09-2026_": [
      { Key: "IDA/dev/Bhopal/recording-01-09-2026_09:15:00.mp4" },
      { Key: "IDA/dev/Bhopal/recording-01-09-2026_23:58:00.mp4" },
    ],
    "IDA/dev/Other/recording-01-09-2026_": [
      { Key: "IDA/dev/Other/recording-01-09-2026_11:00:00.mp4" },
    ],
  };
  const requests = [];
  const client = {
    send: async ({ input }) => {
      requests.push(input);
      if (input.Delimiter === "/") {
        return {
          CommonPrefixes: [{ Prefix: "IDA/dev/Bhopal/" }, { Prefix: "IDA/dev/Other/" }],
          IsTruncated: false,
        };
      }
      return { Contents: objects[input.Prefix] || [], IsTruncated: false };
    },
  };

  const { count, breakdown } = await countRecordingsByKeyTimestamp({
    client,
    bucket: "recordings",
    prefix: "IDA/dev",
    start: moment.tz("2026-09-01 00:00:00", "Asia/Kolkata").toDate(),
    end: moment.tz("2026-09-02 00:00:00", "Asia/Kolkata").toDate(),
    timezone: "Asia/Kolkata",
  });

  assert.equal(count, 3);
  assert.deepEqual(breakdown, { Bhopal: 2, Other: 1 });
  assert.equal(requests[0].Prefix, "IDA/dev/");
  assert.ok(requests.some(({ Prefix }) => Prefix === "IDA/dev/Bhopal/recording-01-09-2026_"));
  assert.ok(requests.every(({ Prefix }) => !Prefix.includes("undefined")));
});

test("excludes recordings whose key timestamp falls outside the report period", async () => {
  const client = {
    send: async ({ input }) => {
      if (input.Delimiter === "/") return { CommonPrefixes: [{ Prefix: "IDA/dev/Bhopal/" }], IsTruncated: false };
      return {
        Contents: [
          { Key: "IDA/dev/Bhopal/recording-01-09-2026_09:15:00.mp4" },
          { Key: "IDA/dev/Bhopal/recording-01-09-2026_23:58:00.mp4" },
        ].filter(({ Key }) => Key.startsWith(input.Prefix)),
        IsTruncated: false,
      };
    },
  };

  const { count, breakdown } = await countRecordingsByKeyTimestamp({
    client,
    bucket: "recordings",
    prefix: "IDA/dev/",
    start: moment.tz("2026-09-01 00:00:00", "Asia/Kolkata").toDate(),
    end: moment.tz("2026-09-01 23:55:00", "Asia/Kolkata").toDate(),
    timezone: "Asia/Kolkata",
  });

  assert.equal(count, 1);
  assert.deepEqual(breakdown, { Bhopal: 1 });
});

test("binds UTC period bounds for call_recordings, whose timestamps are stored in UTC", async () => {
  const priorConfiguration = process.env.DAILY_REPORT_DB_METRICS;
  delete process.env.DAILY_REPORT_DB_METRICS;
  const queries = [];
  const connection = {
    query: async (statement, replacements) => {
      if (statement.includes("offset_seconds")) return [[{ offset_seconds: 19800 }]];
      queries.push({ statement, replacements });
      return [[{ count: 7, total_patients: 7, total_visits_with_prescription: 7 }]];
    },
  };
  const period = {
    timezone: "Asia/Kolkata",
    start: moment.tz("2026-09-01 00:00:00", "Asia/Kolkata"),
    end: moment.tz("2026-09-02 00:00:00", "Asia/Kolkata"),
  };

  try {
    await collectDatabaseMetrics(period, { databases: { portal: connection, openmrs: connection } });
    const recordings = queries.filter(({ statement }) => statement.includes("call_recordings"));

    assert.equal(recordings.length, 4);
    for (const { statement, replacements } of recordings) {
      assert.match(statement, /start_time >= :startUtc/);
      assert.match(statement, /start_time < :endUtc/);
      assert.doesNotMatch(statement, /CURDATE\(\)/);
      assert.equal(replacements.startUtc, "2026-08-31 18:30:00");
      assert.equal(replacements.endUtc, "2026-09-01 18:30:00");
    }
    assert.ok(recordings.some(({ statement }) => statement.includes("end_time IS NOT NULL")));
    assert.ok(recordings.some(({ statement }) => statement.includes("AVG(TIMESTAMPDIFF")));
    assert.ok(recordings.some(({ statement }) => statement.includes("< 30")));

    const startCalls = queries.find(({ statement }) => statement.includes("call_data"));
    assert.match(startCalls.statement, /createdAt >= :startUtc/);
    assert.doesNotMatch(startCalls.statement, /CURDATE\(\)/);
  } finally {
    if (priorConfiguration == null) delete process.env.DAILY_REPORT_DB_METRICS;
    else process.env.DAILY_REPORT_DB_METRICS = priorConfiguration;
  }
});

test("summarises the busiest locations and folds the tail into a remainder", () => {
  assert.equal(describeBreakdown({}), null);
  assert.equal(describeBreakdown({ Badagi: 8, Surgane: 9 }), "Surgane 9 · Badagi 8");
  assert.equal(
    describeBreakdown({ A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8 }),
    "H 8 · G 7 · F 6 · E 5 · D 4 · C 3 · +2 more"
  );
});

test("skips a recordings metric whose bucket is unset instead of using AWS_BUCKET_NAME", async () => {
  const prior = {
    metrics: process.env.DAILY_REPORT_S3_METRICS,
    webrtc: process.env.WEBRTC_RECORDINGS_S3_BUCKET,
    kaleyra: process.env.KALEYRA_RECORDINGS_S3_BUCKET,
    fallback: process.env.AWS_BUCKET_NAME,
  };
  delete process.env.DAILY_REPORT_S3_METRICS;
  delete process.env.KALEYRA_RECORDINGS_S3_BUCKET;
  process.env.WEBRTC_RECORDINGS_S3_BUCKET = "recordings";
  process.env.WEBRTC_RECORDINGS_S3_PREFIX = "NAS/host/";
  process.env.AWS_BUCKET_NAME = "ih-addl-docs";

  const buckets = [];
  const s3Client = {
    send: async ({ input }) => {
      buckets.push(input.Bucket);
      return input.Delimiter === "/" ? { CommonPrefixes: [], IsTruncated: false } : { Contents: [], IsTruncated: false };
    },
  };

  try {
    const metrics = await collectS3Metrics({
      timezone: "Asia/Kolkata",
      start: moment.tz("2026-09-02 00:00:00", "Asia/Kolkata"),
      end: moment.tz("2026-09-03 00:00:00", "Asia/Kolkata"),
    }, { s3Client });

    assert.deepEqual(metrics.map(({ name }) => name), ["webrtc_recordings"]);
    assert.ok(!buckets.includes("ih-addl-docs"), "must never fall back to the documents bucket");
  } finally {
    for (const [key, value] of [
      ["DAILY_REPORT_S3_METRICS", prior.metrics],
      ["WEBRTC_RECORDINGS_S3_BUCKET", prior.webrtc],
      ["KALEYRA_RECORDINGS_S3_BUCKET", prior.kaleyra],
      ["AWS_BUCKET_NAME", prior.fallback],
    ]) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("derives OpenMRS local bounds from the database clock, not the app timezone", async () => {
  const prior = process.env.DAILY_REPORT_DB_METRICS;
  delete process.env.DAILY_REPORT_DB_METRICS;
  const period = {
    timezone: "Asia/Kolkata",
    start: moment.tz("2026-09-02 00:00:00", "Asia/Kolkata"),
    end: moment.tz("2026-09-03 00:00:00", "Asia/Kolkata"),
  };

  const runWithOffset = async (offsetSeconds) => {
    const seen = [];
    const connection = {
      query: async (statement, replacements) => {
        if (statement.includes("offset_seconds")) return [[{ offset_seconds: offsetSeconds }]];
        seen.push(replacements);
        return [[{ count: 1, total_patients: 1, total_visits_with_prescription: 1 }]];
      },
    };
    await collectDatabaseMetrics(period, { databases: { portal: connection, openmrs: connection } });
    return seen[0];
  };

  try {
    const ist = await runWithOffset(19800);
    const utc = await runWithOffset(0);

    assert.equal(ist.startUtc, "2026-09-01 18:30:00");
    assert.equal(utc.startUtc, "2026-09-01 18:30:00");

    assert.equal(ist.startLocal, "2026-09-02 00:00:00");
    assert.equal(utc.startLocal, "2026-09-01 18:30:00");
  } finally {
    if (prior == null) delete process.env.DAILY_REPORT_DB_METRICS;
    else process.env.DAILY_REPORT_DB_METRICS = prior;
  }
});
