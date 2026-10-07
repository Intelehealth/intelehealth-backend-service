const test = require("node:test");
const assert = require("node:assert/strict");
const moment = require("moment-timezone");
const { collectGaMetrics } = require("../crons/services/report-ga.service");

const GA_ENV = [
  "GA_PROPERTY_ID",
  "GA_SERVICE_ACCOUNT_JSON",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GA_PROPERTY_TIMEZONE",
  "DAILY_REPORT_GA_METRICS",
  "GA_HOSTNAME",
];

const withEnv = async (values, run) => {
  const prior = Object.fromEntries(GA_ENV.map((key) => [key, process.env[key]]));
  try {
    for (const key of GA_ENV) delete process.env[key];
    Object.assign(process.env, values);
    await run();
  } finally {
    for (const key of GA_ENV) {
      if (prior[key] == null) delete process.env[key];
      else process.env[key] = prior[key];
    }
  }
};

const period = {
  timezone: "Asia/Kolkata",
  reportDate: "2026-09-02",
  start: moment.tz("2026-09-02 00:00:00", "Asia/Kolkata"),
  end: moment.tz("2026-09-03 00:00:00", "Asia/Kolkata"),
};

test("skips GA metrics when the property or credentials are unset", async () => {
  await withEnv({}, async () => {
    const warnings = [];
    const metrics = await collectGaMetrics(period, {
      logger: { warn: (message) => warnings.push(message) },
      gaClient: { runReport: async () => assert.fail("must not call GA when unconfigured") },
    });

    assert.deepEqual(metrics, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /GA_PROPERTY_ID/);
  });
});

test("collects every configured event in a single runReport", async () => {
  await withEnv({
    GA_PROPERTY_ID: "123456",
    GA_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: "k" }),
  }, async () => {
    const requests = [];
    const gaClient = {
      runReport: async (request) => {
        requests.push(request);
        return [{
          rows: [
            { dimensionValues: [{ value: "start_call" }], metricValues: [{ value: "74" }] },
            { dimensionValues: [{ value: "whatsapp_call_started" }], metricValues: [{ value: "39" }] },
          ],
        }];
      },
    };

    const metrics = await collectGaMetrics(period, { gaClient });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].property, "properties/123456");
    assert.deepEqual(requests[0].dateRanges, [{ startDate: "2026-09-02", endDate: "2026-09-02" }]);
    assert.deepEqual(
      requests[0].dimensionFilter.filter.inListFilter.values,
      ["start_call", "whatsapp_call_started", "kaleyra_call_initiated",
        "whatsapp_link_opened", "patient_phone_dialled"]
    );
    assert.deepEqual(metrics.map(({ name, value, source }) => [name, value, source]), [
      ["start_call_clicks", 74, "GA4"],
      ["whatsapp_calls_started", 39, "GA4"],
      ["kaleyra_calls_initiated", 0, "GA4"],
      ["whatsapp_links_opened", 0, "GA4"],
      ["patient_phone_dials", 0, "GA4"],
    ]);
  });
});

test("refuses to report when the GA property timezone differs from the report timezone", async () => {
  await withEnv({
    GA_PROPERTY_ID: "123456",
    GA_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: "k" }),
    GA_PROPERTY_TIMEZONE: "America/New_York",
  }, async () => {
    await assert.rejects(
      collectGaMetrics(period, { gaClient: { runReport: async () => assert.fail("must not run") } }),
      /America\/New_York does not match report timezone Asia\/Kolkata/
    );
  });
});

test("rejects a service account without the fields the client needs", async () => {
  await withEnv({
    GA_PROPERTY_ID: "123456",
    GA_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com" }),
  }, async () => {
    await assert.rejects(collectGaMetrics(period, {}), /client_email and private_key/);
  });
});

test("scopes the report to one host so staging traffic is excluded", async () => {
  await withEnv({
    GA_PROPERTY_ID: "123456",
    GA_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: "k" }),
    GA_HOSTNAME: "as.intelehealth.org",
  }, async () => {
    const requests = [];
    const gaClient = {
      runReport: async (request) => {
        requests.push(request);
        return [{ rows: [{ dimensionValues: [{ value: "start_call" }], metricValues: [{ value: "12" }] }] }];
      },
    };

    const metrics = await collectGaMetrics(period, { gaClient });
    const [events, host] = requests[0].dimensionFilter.andGroup.expressions;

    assert.deepEqual(events.filter.inListFilter.values, [
      "start_call", "whatsapp_call_started", "kaleyra_call_initiated",
      "whatsapp_link_opened", "patient_phone_dialled",
    ]);
    assert.equal(host.filter.fieldName, "hostName");
    assert.equal(host.filter.stringFilter.value, "as.intelehealth.org");
    assert.equal(host.filter.stringFilter.matchType, "EXACT");
    assert.equal(metrics.find(({ name }) => name === "start_call_clicks").value, 12);
  });
});

test("warns when no host is configured, because the property is shared", async () => {
  await withEnv({
    GA_PROPERTY_ID: "123456",
    GA_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: "k" }),
  }, async () => {
    const warnings = [];
    await collectGaMetrics(period, {
      logger: { warn: (message) => warnings.push(message) },
      gaClient: { runReport: async () => [{ rows: [] }] },
    });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /GA_HOSTNAME is unset/);
  });
});
