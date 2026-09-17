const { EMERGENCY_LEVEL, CASE_TYPE, SPEC_MATCH, STATUS, DOCTOR_STATUS } = require("../constants");

/**
 * OpenAPI 3 description of the QMS API.
 *
 * Backend LLD §13.6 — "keeping three documents from quietly drifting apart":
 * the same request and response shapes are written by hand in the backend LLD,
 * the Android LLD and the Web LLD, and nothing stops one changing without the
 * other two catching up. This file is the single shared place the doc asks for;
 * the Android and Angular clients should generate from it rather than
 * hand-keeping a third and fourth copy.
 *
 * Served at GET /api-docs (and the raw document at GET /api-docs.json).
 */

const enumOf = (obj) => Object.values(obj);

const queueStatusResponse = {
  type: "object",
  properties: {
    queueEntryId: { type: "integer", example: 4821 },
    visitUuid: { type: "string" },
    patientUuid: { type: "string", nullable: true, description: "OpenMRS patient.uuid." },
    hwUserUuid: {
      type: "string",
      description: "The health worker who raised the visit.",
    },
    locationUuid: { type: "string", description: "The facility the visit was raised at." },
    speciality: { type: "string", example: "General Physician" },
    status: { type: "string", enum: enumOf(STATUS) },
    emergencyLevel: { type: "string", enum: enumOf(EMERGENCY_LEVEL) },
    caseType: { type: "string", enum: enumOf(CASE_TYPE) },
    escalated: { type: "boolean" },
    position: {
      type: "integer",
      nullable: true,
      description:
        "Live rank in the priority-sorted queue. Waiting CRITICAL cases always count ahead of a non-critical case, because the critical lane drains exclusively first (LLD §05.4).",
    },
    etaAt: {
      type: "string",
      format: "date-time",
      nullable: true,
      description:
        "When the consultation is expected, as an absolute instant — the value of record. RENDER YOUR OWN COUNTDOWN FROM THIS: it is anchored and only changes when the estimate genuinely moves, so a client can tick down locally without a push per minute. Derived from the calibrated Little's Law estimate (LLD §07): Lq/(c·μ) + per-speciality overhead, not (position-1) × avg_consult.",
    },
    etaMinutes: {
      type: "integer",
      nullable: true,
      description:
        "Minutes remaining, derived from etaAt at response time. A convenience snapshot for older clients — it is stale as soon as it is read. Prefer etaAt.",
    },
    etaOverdue: {
      type: "boolean",
      description: "True once etaAt has passed. Show an 'any moment now' state rather than a negative countdown.",
    },
    etaModelUsed: { type: "string", enum: ["A", "B"], nullable: true },
    callEndedAt: {
      type: "string",
      format: "date-time",
      nullable: true,
      description:
        "When the CALL ended, which completedAt no longer stands in for: a finished call is not a finished visit. completedAt is stamped only at PRESCRIPTION_COMPLETED.",
    },
    prescriptionPending: {
      type: "boolean",
      description:
        "The call is over but the doctor still owes a prescription — status CALL_COMPLETED. Closed only by POST /visit/{visitUuid}/prescription-shared.",
    },
    prescriptionOutstandingMinutes: {
      type: "integer",
      nullable: true,
      description:
        "Minutes since the call ended. null when the case is not awaiting a prescription — distinct from 0, which means under a minute.",
    },
    prescriptionOverdue: {
      type: "boolean",
      description:
        "Past PRESCRIPTION_OVERDUE_MINUTES. Reporting only: nothing auto-completes an outstanding prescription.",
    },
    assignedDoctorUuid: { type: "string", nullable: true },
    queuedAt: { type: "string", format: "date-time", nullable: true },
    assignedAt: { type: "string", format: "date-time", nullable: true },
    connectedAt: { type: "string", format: "date-time", nullable: true },
    completedAt: { type: "string", format: "date-time", nullable: true },
    heartbeatStale: {
      type: "boolean",
      description:
        "The patient app has not checked in recently. A flag for review only — a stale heartbeat never cancels a case, because a patient may still be waiting after their app died.",
    },
  },
};

const envelope = (dataSchema) => ({
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string", example: "success" },
    data: dataSchema,
  },
});

const errorResponse = {
  description: "Error",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          code: { type: "string", example: "CASE_ALREADY_CLAIMED" },
          message: { type: "string" },
          details: { type: "object", additionalProperties: true },
        },
      },
    },
  },
};

const ok = (schema, description = "OK") => ({
  description,
  content: { "application/json": { schema: envelope(schema) } },
});

const entryPathParam = {
  name: "queueEntryId",
  in: "path",
  required: true,
  schema: { type: "integer" },
};

module.exports = {
  openapi: "3.0.3",
  info: {
    title: "Intelehealth Queue Management System (QMS)",
    version: "1.0.0",
    description: [
      "Live patient queue, priority scoring, doctor assignment and wait-time estimation.",
      "",
      "Implements the QMS Low-Level Design (§02–§14) and the Priority Engine Algorithm Spec (§01–§11) on MySQL.",
      "",
      "**Auth** — every endpoint accepts either a user `Bearer` JWT (RS256, verified with the shared OpenMRS/auth-gateway public key) or the internal `x-qms-secret` header for service-to-service callers such as web-rtc and portal.",
      "",
      "**This service never calls web-rtc.** After a successful claim the client calls LiveKit's `getToken` itself, exactly as it does today (LLD §01, §11).",
    ].join("\n"),
  },
  servers: [{ url: "/", description: "This service" }],
  tags: [
    { name: "Queue lists", description: "Queue items, all or speciality-wise" },
    { name: "Health worker", description: "LLD §09.1 — submit & track" },
    { name: "Doctor", description: "LLD §09.2 — queue panel & claiming" },
    { name: "Doctor status", description: "LLD §09.3 — live online/offline/away" },
    { name: "Call lifecycle", description: "Keyed by visit — driven by web-rtc and portal" },
    { name: "Analytics", description: "LLD §09.4 — live ops view and ETA accuracy" },
    { name: "Config", description: "Priority Engine §07 — tunable weights, aging, SLA caps" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      serviceSecret: { type: "apiKey", in: "header", name: "x-qms-secret" },
    },
    schemas: {
      QueueStatus: queueStatusResponse,
      QueueItem: {
        allOf: [
          { $ref: "#/components/schemas/QueueStatus" },
          {
            type: "object",
            properties: {
              flagged: { type: "boolean" },
              escalatedAt: { type: "string", format: "date-time", nullable: true },
              waitedMinutes: { type: "integer" },
              priorityScore: {
                type: "number",
                description:
                  "Only present with includeScore=true for an admin or internal service. A sort key, never a display value (Priority Engine §01).",
              },
            },
          },
        ],
      },
    },
  },
  security: [{ bearerAuth: [] }, { serviceSecret: [] }],
  paths: {
    "/health": {
      get: {
        tags: ["Analytics"],
        summary: "Liveness and readiness",
        security: [],
        responses: { 200: ok({ type: "object" }) },
      },
    },

    "/api/queue/submit": {
      post: {
        tags: ["Health worker"],
        summary: "Submit a visit to the queue",
        description: [
          "Called right after a visit is uploaded to OpenMRS. Scores priority, checks for a free doctor, and either returns `READY` (a doctor is assigned — go call getToken) or `QUEUED`.",
          "",
          "**Idempotent on `visitUuid`.** A flaky mobile connection means the app may retry after a timeout even though the first attempt succeeded; a repeat submit returns the existing entry's status rather than putting the same visit in the queue twice.",
        ].join("\n"),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["visitUuid", "patientUuid", "locationUuid", "speciality"],
                properties: {
                  visitUuid: { type: "string", description: "OpenMRS visit.uuid — the dedupe key" },
                  patientUuid: { type: "string", description: "OpenMRS patient.uuid." },
                  hwUserUuid: {
                    type: "string",
                    description: "Defaults to the caller; only admins/services may set another.",
                  },
                  locationUuid: {
                    type: "string",
                    maxLength: 64,
                    description:
                      "The facility the visit was raised at. Required — every case must be attributable to somewhere, and the ops reads filter on it. It does NOT split the queue: cases still share one line per speciality.",
                  },
                  speciality: {
                    type: "string",
                    description:
                      "Free text, and it IS the queue key — two spellings are two queues.",
                  },
                  emergencyLevel: { type: "string", enum: enumOf(EMERGENCY_LEVEL) },
                  caseType: { type: "string", enum: enumOf(CASE_TYPE) },
                  specMatch: { type: "string", enum: enumOf(SPEC_MATCH) },
                  flagged: {
                    type: "boolean",
                    description:
                      "True when the visit has a type-15 'Flagged' encounter. Acts as a HIGH floor on emergency level (Priority Engine §00).",
                  },
                  chiefComplaint: {
                    type: "string",
                    description:
                      "Accepted and discarded. Clinical detail stays in OpenMRS — QMS stores none of it, and it is never returned.",
                  },
                  vitals: {
                    type: "object",
                    description:
                      "Thresholds are summed, never first-match (Priority Engine §02.5). SpO2<90 +300, systolic>180 +200, pulse>120 +150, temp>103F +100.",
                    properties: {
                      spo2: { type: "number" },
                      systolicBp: { type: "number" },
                      pulse: { type: "number" },
                      tempF: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: ok(
            {
              type: "object",
              properties: {
                deduped: { type: "boolean" },
                status: { type: "string", enum: ["READY", "QUEUED"] },
                entry: queueStatusResponse,
              },
            },
            "Queued, or assigned immediately"
          ),
          200: ok({ type: "object" }, "Duplicate submit — existing entry returned"),
          429: errorResponse,
          default: errorResponse,
        },
      },
    },

    "/api/queue/{queueEntryId}/status": {
      get: {
        tags: ["Health worker"],
        summary: "Poll current position and ETA",
        description:
          "Backs notification tier 4 ('pull on demand', LLD §08) and is the resync call after any connectivity gap.",
        parameters: [entryPathParam],
        responses: { 200: ok(queueStatusResponse), default: errorResponse },
      },
    },

    "/api/queue/{queueEntryId}": {
      delete: {
        tags: ["Health worker"],
        summary: "Withdraw the case",
        description: "Patient left or was resolved another way. Marks the entry CANCELLED.",
        parameters: [entryPathParam],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { reason: { type: "string" } } },
            },
          },
        },
        responses: { 200: ok(queueStatusResponse), default: errorResponse },
      },
    },

    "/api/queue/{queueEntryId}/heartbeat": {
      post: {
        tags: ["Health worker"],
        summary: "Keep-alive",
        description:
          "Entries with no heartbeat for more than HEARTBEAT_STALE_MINUTES are flagged for review — never auto-cancelled. A patient may still be waiting even if the app died (LLD §09.1).",
        parameters: [entryPathParam],
        responses: { 200: ok(queueStatusResponse), 429: errorResponse, default: errorResponse },
      },
    },

    "/api/queue/list": {
      get: {
        tags: ["Queue lists"],
        summary: "All queue items, or one speciality's",
        description: [
          "Returns queue items in the order the queue is actually served — ESCALATED, then CRITICAL, then by priority score, then FIFO — so the top of the list is the next patient, not merely the oldest.",
          "",
          "Positions are computed against the **full lane**, not the returned page: asking for page 3 does not renumber anyone from 1.",
          "",
          "**Access.** Admins and internal services (`x-qms-secret`) see everything. Any other caller is scoped to cases they submitted or are assigned to, so an ordinary login cannot read the whole patient list (LLD §13.1). The response echoes `appliedFilters.scopedToCaller` so a client can tell which it got.",
          "",
          "`priorityScore` is withheld unless `includeScore=true` **and** the caller is privileged — Priority Engine §01: P is a sort key, never a display value. Show `position` and `etaMinutes` instead.",
        ].join("\n"),
        parameters: [
          {
            name: "status",
            in: "query",
            description:
              "Group — `WAITING` (default; QUEUED + ESCALATED + RE_QUEUED), `ACTIVE` (adds ASSIGNED/CALL_CONNECTING/CALL_CONNECTED and CALL_COMPLETED), `AWAITING_PRESCRIPTION` (just CALL_COMPLETED), `ALL` — or a comma-separated list of explicit statuses.",
            schema: { type: "string", default: "WAITING" },
          },
          { name: "speciality", in: "query", schema: { type: "string" } },
          {
            name: "locationUuid",
            in: "query",
            description: "Only cases raised at this facility.",
            schema: { type: "string", maxLength: 64 },
          },
          { name: "emergencyLevel", in: "query", schema: { type: "string", enum: enumOf(EMERGENCY_LEVEL) } },
          { name: "caseType", in: "query", schema: { type: "string", enum: enumOf(CASE_TYPE) } },
          { name: "hwUserUuid", in: "query", schema: { type: "string" } },
          { name: "doctorUuid", in: "query", schema: { type: "string" } },
          { name: "visitUuid", in: "query", schema: { type: "string" } },
          { name: "patientUuid", in: "query", schema: { type: "string" } },
          { name: "escalated", in: "query", schema: { type: "boolean" } },
          { name: "flagged", in: "query", schema: { type: "boolean" } },
          { name: "queuedFrom", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "queuedTo", in: "query", schema: { type: "string", format: "date-time" } },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["priority", "queuedAt", "-queuedAt", "waitedLongest", "recent"],
              default: "priority",
            },
          },
          {
            name: "includeEta",
            in: "query",
            description: "Set false for a cheaper poll that only needs positions.",
            schema: { type: "boolean", default: true },
          },
          { name: "includeScore", in: "query", schema: { type: "boolean", default: false } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: ok(
            {
              type: "object",
              properties: {
                items: { type: "array", items: { $ref: "#/components/schemas/QueueItem" } },
                total: { type: "integer" },
                limit: { type: "integer" },
                offset: { type: "integer" },
                hasMore: { type: "boolean" },
                appliedFilters: { type: "object", additionalProperties: true },
              },
            },
            "A page of queue items"
          ),
          default: errorResponse,
        },
      },
    },

    "/api/queue/specialities": {
      get: {
        tags: ["Queue lists"],
        summary: "Speciality-wise counts",
        description: [
          "One row per speciality: how many are waiting, how many escalated or critical, how many currently in consultation, longest and average wait.",
          "",
          "Distinct from `/analytics/live`, which is the ops dashboard (doctor presence and utilisation). This one is purely queue-side and cheap enough to poll from a health-worker app.",
          "",
          "`withItems=true` attaches the top N cases per speciality, so counts and a preview arrive in one round trip.",
        ].join("\n"),
        parameters: [
          {
            name: "status",
            in: "query",
            description: "Defaults to `ACTIVE` here, so in-consultation cases are counted.",
            schema: { type: "string", default: "ACTIVE" },
          },
          { name: "speciality", in: "query", schema: { type: "string" } },
          {
            name: "locationUuid",
            in: "query",
            description: "Only cases raised at this facility.",
            schema: { type: "string", maxLength: 64 },
          },
          { name: "withItems", in: "query", schema: { type: "boolean", default: false } },
          { name: "itemsPerSpeciality", in: "query", schema: { type: "integer", default: 5, maximum: 25 } },
        ],
        responses: {
          200: ok(
            {
              type: "object",
              properties: {
                generatedAt: { type: "string", format: "date-time" },
                totals: { type: "object", additionalProperties: true },
                specialities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      speciality: { type: "string" },
                      waiting: { type: "integer" },
                      escalated: { type: "integer" },
                      critical: { type: "integer" },
                      flagged: { type: "integer" },
                      heartbeatFlagged: { type: "integer" },
                      inService: { type: "integer" },
                      longestWaitMin: { type: "integer" },
                      averageWaitMin: { type: "integer" },
                      averageEtaMin: { type: "integer", nullable: true },
                      oldestQueuedAt: { type: "string", format: "date-time", nullable: true },
                      items: {
                        type: "array",
                        items: { $ref: "#/components/schemas/QueueItem" },
                      },
                    },
                  },
                },
              },
            },
            "Counts per speciality, ordered by queue depth"
          ),
          default: errorResponse,
        },
      },
    },

    "/api/queue/doctor/{doctorUuid}/list": {
      get: {
        tags: ["Doctor"],
        summary: "The doctor queue panel",
        description:
          "Merges the critical lane with the doctor's speciality lane, in priority order (LLD §09.2).",
        parameters: [
          { name: "doctorUuid", in: "path", required: true, schema: { type: "string" } },
          { name: "speciality", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: ok({ type: "object" }), default: errorResponse },
      },
    },

    "/api/queue/doctor/{doctorUuid}/next": {
      post: {
        tags: ["Doctor"],
        summary: "Claim the next patient",
        description:
          "Case-first selection (Priority Engine §06) with SELECT … FOR UPDATE SKIP LOCKED, so two doctors asking at the same instant get two different cases.",
        parameters: [{ name: "doctorUuid", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok(queueStatusResponse), default: errorResponse },
      },
    },

    "/api/queue/{queueEntryId}/claim": {
      post: {
        tags: ["Doctor"],
        summary: "Claim a specific case",
        description: [
          "Two doctors can click the same case within the same second; this resolves to exactly one winner.",
          "",
          "The loser gets **409 `CASE_ALREADY_CLAIMED`** — not a silent success. Show it: a doctor who loses the race and sees nothing happen will reasonably assume the app is broken (Web LLD §05).",
          "",
          "This endpoint does not call web-rtc. The client calls getToken itself.",
        ].join("\n"),
        parameters: [entryPathParam],
        responses: {
          200: ok(queueStatusResponse),
          409: errorResponse,
          default: errorResponse,
        },
      },
    },

    "/api/queue/{queueEntryId}/release": {
      post: {
        tags: ["Doctor"],
        summary: "Hand the case back",
        description:
          "Wrong speciality picked up by mistake, etc. Returns to the queue at its prior score — explicitly not penalised (LLD §09.2).",
        parameters: [entryPathParam],
        responses: { 200: ok(queueStatusResponse), 409: errorResponse, default: errorResponse },
      },
    },

    "/api/queue/{queueEntryId}/complete": {
      post: {
        tags: ["Doctor"],
        summary: "Consultation finished",
        description:
          "Frees the doctor and folds the consult duration into doctor_service_stats.avg_consult_min — the EMA that is μ in the wait-time formula (LLD §07).",
        parameters: [entryPathParam],
        responses: { 200: ok(queueStatusResponse), 409: errorResponse, default: errorResponse },
      },
    },

    "/api/queue/{queueEntryId}/connecting": {
      post: {
        tags: ["Doctor"],
        summary: "LiveKit room requested",
        parameters: [entryPathParam],
        responses: { 200: ok(queueStatusResponse), 409: errorResponse, default: errorResponse },
      },
    },
    "/api/queue/{queueEntryId}/connected": {
      post: {
        tags: ["Doctor"],
        summary: "Video call active",
        parameters: [entryPathParam],
        responses: { 200: ok(queueStatusResponse), 409: errorResponse, default: errorResponse },
      },
    },
    "/api/queue/{queueEntryId}/requeue": {
      post: {
        tags: ["Doctor"],
        summary: "Connection failed — return to the queue with a bump",
        parameters: [entryPathParam],
        responses: { 200: ok(queueStatusResponse), 409: errorResponse, default: errorResponse },
      },
    },

    "/api/queue/visit/{visitUuid}": {
      get: {
        tags: ["Call lifecycle"],
        summary: "Resolve a visit to its queue entry",
        description:
          "Keyed by visit because that is the identifier web-rtc and portal hold; neither ever sees our queue_entry id.",
        parameters: [{ name: "visitUuid", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok(queueStatusResponse), 404: errorResponse, default: errorResponse },
      },
    },

    "/api/queue/visit/{visitUuid}/call-connected": {
      post: {
        tags: ["Call lifecycle"],
        summary: "A participant joined the room",
        description: [
          "Fired by web-rtc when the call actually starts.",
          "",
          "LiveKit emits no 'connecting' event, so this walks an ASSIGNED case through CALL_CONNECTING itself rather than rejecting the transition the lifecycle would otherwise require.",
          "",
          "Idempotent: a re-delivered webhook answers 200 with `changed: false`.",
        ].join("\n"),
        parameters: [{ name: "visitUuid", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: ok({
            type: "object",
            properties: {
              changed: { type: "boolean" },
              entry: { $ref: "#/components/schemas/QueueStatus" },
            },
          }),
          404: errorResponse,
          default: errorResponse,
        },
      },
    },

    "/api/queue/visit/{visitUuid}/call-disconnected": {
      post: {
        tags: ["Call lifecycle"],
        summary: "The room finished or the last participant left",
        description: [
          "Fired by web-rtc when the call ends. The outcome depends on whether the call ever connected, and is reported back in `outcome`:",
          "",
          "- a call that connected becomes **CALL_COMPLETED** — the call is over, the visit is not (or PRESCRIPTION_COMPLETED directly, when `REQUIRE_PRESCRIPTION_TO_COMPLETE` is off)",
          "- a call that never established becomes **RE_QUEUED** with a priority bump — a failed attempt, not a finished consultation",
          "",
          "This is also where the consult duration feeds `avg_consult_min` (μ in the §07 estimate), measured to the call ending rather than to completion.",
          "",
          "Idempotent: already-terminal cases answer 200 with `changed: false`.",
        ].join("\n"),
        parameters: [{ name: "visitUuid", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: ok({
            type: "object",
            properties: {
              changed: { type: "boolean" },
              outcome: {
                type: "string",
                enum: ["CALL_COMPLETED", "PRESCRIPTION_COMPLETED", "RE_QUEUED"],
              },
              entry: { $ref: "#/components/schemas/QueueStatus" },
            },
          }),
          404: errorResponse,
          default: errorResponse,
        },
      },
    },

    "/api/queue/visit/{visitUuid}/prescription-shared": {
      post: {
        tags: ["Call lifecycle"],
        summary: "The prescription is shared — the visit is done",
        description: [
          "A finished call is not a finished visit. A call ending leaves the case in `CALL_COMPLETED`, and this is the only thing that moves it to `PRESCRIPTION_COMPLETED` — the single successful ending in the lifecycle.",
          "",
          "Called by whoever owns that moment — portal, or the doctor webapp. QMS never queries OpenMRS itself, so it is told rather than asking.",
          "",
          "It also closes a consultation that never had a call at all — an asynchronous one, written straight from the notes — because ASSIGNED, CALL_CONNECTING and CALL_CONNECTED all reach PRESCRIPTION_COMPLETED directly. On those paths it ends the call too, so the doctor is freed and the lane moves.",
          "",
          "Idempotent: an already-completed case answers 200 with `changed: false`. A case still waiting in the queue is a **409 `NOT_AWAITING_PRESCRIPTION`** — there is no consultation to prescribe from, and completing it would lose a patient out of the line.",
        ].join("\n"),
        parameters: [{ name: "visitUuid", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: ok({
            type: "object",
            properties: {
              changed: { type: "boolean" },
              entry: { $ref: "#/components/schemas/QueueStatus" },
            },
          }),
          409: errorResponse,
          404: errorResponse,
          default: errorResponse,
        },
      },
    },

    "/api/doctor/{doctorUuid}/status": {
      patch: {
        tags: ["Doctor status"],
        summary: "Set live status",
        description: [
          "**The most important new endpoint in the LLD.** Every queue-facing screen must call it on login, logout and idle timeout — it is what closes the accuracy gap the Little's Law production report identified (168 → ~52 min MAE).",
          "",
          "A doctor may only change their own status; overriding someone else's requires an admin role (LLD §13.1).",
        ].join("\n"),
        parameters: [{ name: "doctorUuid", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: enumOf(DOCTOR_STATUS) },
                  speciality: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: ok({ type: "object" }), 403: errorResponse, default: errorResponse },
      },
      get: {
        tags: ["Doctor status"],
        summary: "Read the durable copy (reporting)",
        parameters: [{ name: "doctorUuid", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok({ type: "object" }), default: errorResponse },
      },
    },

    "/api/queue/analytics/live": {
      get: {
        tags: ["Analytics"],
        summary: "Per-speciality ops snapshot",
        description: "Queue depth, average wait, doctors online, utilisation (LLD §09.4).",
        parameters: [
          { name: "speciality", in: "query", schema: { type: "string" } },
          {
            name: "locationUuid",
            in: "query",
            description: "Only cases raised at this facility.",
            schema: { type: "string", maxLength: 64 },
          },
        ],
        responses: { 200: ok({ type: "object" }), default: errorResponse },
      },
    },

    "/api/queue/analytics/accuracy": {
      get: {
        tags: ["Analytics"],
        summary: "Always-on Little's Law accuracy report",
        description:
          "MAE, bias and % within 15/30 minutes, filterable by speciality and doctor. This is how the team decides when to re-tune eta_model_used or a speciality's overhead constant (LLD §09.4, §12).",
        parameters: [
          { name: "speciality", in: "query", schema: { type: "string" } },
          { name: "doctorUuid", in: "query", schema: { type: "string" } },
          { name: "sinceHours", in: "query", schema: { type: "integer", default: 24 } },
        ],
        responses: { 200: ok({ type: "object" }), default: errorResponse },
      },
    },

    "/api/queue/config": {
      get: {
        tags: ["Config"],
        summary: "Read the live priority configuration",
        responses: { 200: ok({ type: "object" }), default: errorResponse },
      },
      put: {
        tags: ["Config"],
        summary: "Re-tune the priority engine (admin)",
        description:
          "Validated before it is stored: Σweights ≠ 1.0 is rejected outright rather than run miscalibrated (Priority Engine §07).",
        responses: { 200: ok({ type: "object" }), 400: errorResponse, 403: errorResponse },
      },
    },
  },
};
