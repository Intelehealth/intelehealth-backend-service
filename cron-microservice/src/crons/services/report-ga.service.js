const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const { parseJsonArray } = require("../../config");

/*
  GA4 answers questions no server-side source can: a literal button press that
  never reaches the backend. It is deliberately a secondary source — reporting
  data is not final intraday, and ad blockers drop gtag entirely, so these
  counts are a floor rather than an exact total.

  Every configured metric is one eventName, so the whole set is collected with a
  single runReport that groups by eventName rather than one call per metric.
*/
const GA_SECTION = "Engagement (GA4)";

const DEFAULT_GA_METRICS = [
  {
    name: "start_call_clicks",
    label: "Start Call button presses",
    section: GA_SECTION,
    eventName: "start_call",
  },
  {
    name: "whatsapp_calls_started",
    label: "WhatsApp calls started",
    section: GA_SECTION,
    eventName: "whatsapp_call_started",
  },
  {
    name: "kaleyra_calls_initiated",
    label: "Kaleyra calls initiated",
    section: GA_SECTION,
    eventName: "kaleyra_call_initiated",
  },
  {
    name: "whatsapp_links_opened",
    label: "Patient WhatsApp icon taps",
    section: GA_SECTION,
    eventName: "whatsapp_link_opened",
  },
  {
    name: "patient_phone_dials",
    label: "Patient phone icon taps",
    section: GA_SECTION,
    eventName: "patient_phone_dialled",
  },
];

const GA_SOURCE = "GA4";

const gaMetrics = () => {
  const metrics = parseJsonArray(process.env.DAILY_REPORT_GA_METRICS, DEFAULT_GA_METRICS);
  return metrics.map((metric) => {
    if (!metric || !metric.name || !metric.label || !metric.eventName) {
      throw new Error("Invalid GA metric; required fields: name, label, eventName");
    }
    return metric;
  });
};

const credentialsFromEnv = () => {
  const inline = process.env.GA_SERVICE_ACCOUNT_JSON;
  if (!inline) return undefined;
  const parsed = JSON.parse(inline);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GA_SERVICE_ACCOUNT_JSON must contain client_email and private_key");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
};

const isConfigured = () => Boolean(
  process.env.GA_PROPERTY_ID
  && (process.env.GA_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS)
);

const createClient = () => new BetaAnalyticsDataClient({ credentials: credentialsFromEnv() });

/*
  GA4 resolves a dateRange against the property's own timezone, not ours. A
  property in a different zone would silently report a shifted day, so the
  configured GA_PROPERTY_TIMEZONE is asserted against the report timezone.
*/
const assertTimezone = (period) => {
  const propertyTimezone = process.env.GA_PROPERTY_TIMEZONE;
  if (propertyTimezone && propertyTimezone !== period.timezone) {
    throw new Error(
      `GA property timezone ${propertyTimezone} does not match report timezone ${period.timezone}`
    );
  }
};

/*
  Every NAS deployment - production, nasstaging, nasstagingnew, ttxai - ships the
  same GAMEASUREMENTID, so the property mixes staging traffic with production.
  GA_HOSTNAME narrows the report to one host; without it the counts are the sum
  of every environment.
*/
const eventFilter = (eventNames) => ({
  filter: { fieldName: "eventName", inListFilter: { values: eventNames } },
});

const hostFilter = (hostName) => ({
  filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: hostName } },
});

const dimensionFilterFor = (eventNames, hostName) => (hostName
  ? { andGroup: { expressions: [eventFilter(eventNames), hostFilter(hostName)] } }
  : eventFilter(eventNames));

const runEventReport = async ({ client, propertyId, reportDate, eventNames, hostName }) => {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: reportDate, endDate: reportDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: dimensionFilterFor(eventNames, hostName),
    limit: 200,
  });

  const counts = new Map();
  for (const row of response.rows || []) {
    const name = row.dimensionValues?.[0]?.value;
    const value = Number(row.metricValues?.[0]?.value ?? 0);
    if (name) counts.set(name, Number.isFinite(value) ? value : 0);
  }
  return counts;
};

const collectGaMetrics = async (period, dependencies = {}) => {
  const metrics = gaMetrics();
  if (!metrics.length) return [];

  if (!isConfigured()) {
    (dependencies.logger || console).warn(
      "[cron-microservice] GA metrics skipped: set GA_PROPERTY_ID and GA_SERVICE_ACCOUNT_JSON"
    );
    return [];
  }

  assertTimezone(period);
  if (!process.env.GA_HOSTNAME) {
    (dependencies.logger || console).warn(
      "[cron-microservice] GA_HOSTNAME is unset; GA counts include every environment sharing this property"
    );
  }
  const client = dependencies.gaClient || createClient();
  const counts = await runEventReport({
    client,
    propertyId: process.env.GA_PROPERTY_ID,
    reportDate: period.reportDate,
    eventNames: [...new Set(metrics.map((metric) => metric.eventName))],
    hostName: process.env.GA_HOSTNAME,
  });

  return metrics.map((metric) => ({
    name: metric.name,
    label: metric.label,
    section: metric.section || GA_SECTION,
    value: counts.get(metric.eventName) ?? 0,
    source: GA_SOURCE,
  }));
};

module.exports = { collectGaMetrics, gaMetrics, isConfigured, runEventReport, DEFAULT_GA_METRICS };
