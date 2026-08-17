require("dotenv").config();

const path = require("path");

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
};

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const csv = (value, fallback = []) =>
  value ? String(value).split(",").map((s) => s.trim()).filter(Boolean) : fallback;

module.exports = {
  env: process.env.NODE_ENV || "development",
  port: num(process.env.PORT, 3600),

  db: {
    host: process.env.DB_HOST || "localhost",
    port: num(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || "mindmap_server",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || null,
    sync: bool(process.env.DB_SYNC, false),
    logging: bool(process.env.DB_LOGGING, false),
  },

  auth: {
    // Shared RSA public key issued by OpenMRS/auth-gateway — same scheme as
    // portal / web-rtc / pagerduty. .pem/ is gitignored; copy public_key.pem in.
    publicKeyPath:
      process.env.JWT_PUBLIC_KEY_PATH ||
      path.resolve(__dirname, "..", "..", ".pem", "public_key.pem"),
    algorithms: csv(process.env.JWT_ALGORITHMS, ["RS256"]),
    // Internal service-to-service header (web-rtc, portal → QMS).
    serviceSecret: process.env.QMS_SERVICE_SECRET || "",
    // LLD §13.1 — only these roles may act on behalf of another user.
    adminRoles: csv(process.env.QMS_ADMIN_ROLES, ["admin", "superadmin"]),
  },

  // LLD §13.2 — stop one bad client from flooding the queue.
  rateLimit: {
    enabled: bool(process.env.RATE_LIMIT_ENABLED, true),
    submitPerMinute: num(process.env.RATE_LIMIT_SUBMIT_PER_MIN, 10),
    heartbeatPerMinute: num(process.env.RATE_LIMIT_HEARTBEAT_PER_MIN, 30),
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  },

  queue: {
    // LLD §13.5 — one line per speciality, or one per speciality *per facility*.
    // Left configurable on purpose: the LLD flags this as an unresolved product
    // decision. SPECIALITY = one shared line across all facilities.
    scope: (process.env.QUEUE_SCOPE || "SPECIALITY").toUpperCase(),
    // Priority Engine §05 — critical fast lane. SPECIALITY keeps the lane inside
    // the case's own speciality (a cardiology critical case never lands on a
    // dermatologist); GLOBAL is the literal all-specialities lane from LLD §03.
    criticalLaneScope: (process.env.CRITICAL_LANE_SCOPE || "SPECIALITY").toUpperCase(),
    // LLD §04 defines ESCALATED as "sits at the front regardless of score",
    // and Priority Engine §09's starvation regression requires a FOLLOW_UP to
    // clear its cap regardless of the critical arrival rate — which only holds
    // if an SLA breach can overtake the critical lane. §05.4's guarantee is
    // about score arithmetic, and still holds either way. Set false for the
    // strict §05.4 reading (CRITICAL always first). Clinical call.
    escalationOutranksCritical: bool(process.env.ESCALATION_OUTRANKS_CRITICAL, true),
    // Fallback avg consult time (seconds) when a doctor has no history yet.
    defaultConsultSeconds: num(process.env.DEFAULT_CONSULT_SECONDS, 480),
    // Heartbeat older than this flags the entry for review — never auto-cancels
    // it (LLD §09.1: a patient may still be waiting even if the app died).
    heartbeatStaleMinutes: num(process.env.HEARTBEAT_STALE_MINUTES, 10),
    // ASSIGNED/CONNECTING with no call ever starting → RE_QUEUED with a bump.
    connectingTimeoutMinutes: num(process.env.CONNECTING_TIMEOUT_MINUTES, 5),
    // CONNECTED with no completion signal → swept closed (client crashed).
    staleAfterMinutes: num(process.env.STALE_AFTER_MINUTES, 30),
    // Priority added when a case returns to the queue after a failed call.
    requeueBonus: num(process.env.REQUEUE_BONUS, 100),
    defaultDoctorRating: num(process.env.DEFAULT_DOCTOR_RATING, 4),
    // Exponential moving average factor for doctor_service_stats.avg_consult_min.
    consultEmaAlpha: num(process.env.CONSULT_EMA_ALPHA, 0.3),
    // LLD §06 — reuse portal's existing day-off data instead of a new calendar
    // table. Off by default because it reads a table owned by another service.
    shiftCheckEnabled: bool(process.env.SHIFT_CHECK_ENABLED, false),
    shiftTable: process.env.SHIFT_TABLE || "appointment_schedules",
  },

  // LLD §07 — estimated wait time.
  eta: {
    // Per-speciality Little's Law model. "A" = speciality-pooled, "B" =
    // doctor-level. Per-speciality because the prototype found General
    // Physician needs B while Paediatrics was more accurate on A.
    defaultModel: (process.env.ETA_DEFAULT_MODEL || "B").toUpperCase(),
    modelBySpeciality: (() => {
      try {
        return JSON.parse(process.env.ETA_MODEL_BY_SPECIALITY || "{}");
      } catch (_) {
        return {};
      }
    })(),
    // Fixed per-speciality overhead (login delay, case review). ~19-20 min
    // baseline from the Little's Law production calibration.
    defaultOverheadMin: num(process.env.ETA_DEFAULT_OVERHEAD_MIN, 19),
    overheadBySpeciality: (() => {
      try {
        return JSON.parse(process.env.ETA_OVERHEAD_BY_SPECIALITY || "{}");
      } catch (_) {
        return {};
      }
    })(),
  },

  // LLD §08 — notification tiering. No sockets in QMS: tiering decides when a
  // push fires and when the entry is updated silently for the poll endpoint.
  notification: {
    enabled: bool(process.env.NOTIFICATION_ENABLED, true),
    webhookUrl: process.env.NOTIFICATION_WEBHOOK_URL || "",
    webhookSecret: process.env.NOTIFICATION_WEBHOOK_SECRET || "",
    webhookTimeoutMs: num(process.env.NOTIFICATION_WEBHOOK_TIMEOUT_MS, 4000),
    debounceMs: num(process.env.NOTIFICATION_DEBOUNCE_MS, 500),
    deferredBatchMs: num(process.env.NOTIFICATION_DEFERRED_BATCH_MS, 10000),
    periodicBatchMs: num(process.env.NOTIFICATION_PERIODIC_BATCH_MS, 75000),
    ewtDeltaMinutes: num(process.env.NOTIFICATION_EWT_DELTA_MIN, 5),
    ewtMinIntervalMs: num(process.env.NOTIFICATION_EWT_MIN_INTERVAL_MS, 30000),
  },

  jobs: {
    enabled: bool(process.env.JOBS_ENABLED, true),
    agingCron: process.env.AGING_CRON || "*/5 * * * *",
    slaCron: process.env.SLA_CRON || "* * * * *",
    sweepCron: process.env.SWEEP_CRON || "*/5 * * * *",
    accuracyCron: process.env.ACCURACY_CRON || "*/10 * * * *",
    batchSize: num(process.env.JOB_BATCH_SIZE, 500),
  },

  // LLD §13.4 — page whoever is on call when the wait estimate drifts badly.
  // Ops alerting only: never carries patient data.
  accuracyAlert: {
    enabled: bool(process.env.ACCURACY_ALERT_ENABLED, false),
    webhookUrl: process.env.ACCURACY_ALERT_WEBHOOK_URL || "",
    maeThresholdMin: num(process.env.ACCURACY_ALERT_MAE_MIN, 90),
    sustainedForMin: num(process.env.ACCURACY_ALERT_SUSTAINED_MIN, 30),
    lookbackMin: num(process.env.ACCURACY_ALERT_LOOKBACK_MIN, 60),
    minSamples: num(process.env.ACCURACY_ALERT_MIN_SAMPLES, 10),
  },
};
