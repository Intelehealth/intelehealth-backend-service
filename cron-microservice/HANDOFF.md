# cron-microservice handoff

Context for whoever picks up the crons next: how they are wired, how the AI DDx
auto-compute pipeline moves a visit through the queue, and the production
gotchas already hit. Last updated 2026-10-08.

## Crons in this service

| Cron | Default schedule | Own flag | Lock name |
| --- | --- | --- | --- |
| `daily-operations-report` | `55 23 * * *` (`DAILY_REPORT_CRON`) | `DAILY_REPORT_CRON_ENABLED` (default on) | `cron_microservice_daily_report` |
| `visit-queue-sync` | `*/30 * * * * *` (`AI_VISIT_CRON_TIMINGS_DDX_QUEUE`) | `AI_DDX_PIPELINE_ENABLED` (default off) | `cron_microservice_visit_queue_sync` |
| `ddx-worker` | `*/30 * * * * *` (`AI_VISIT_CRON_TIMINGS_DDX_CALL`) | `AI_DDX_PIPELINE_ENABLED` (default off) | `cron_microservice_ddx_worker` |

All three are declared in one list in `src/crons/index.js`. A new cron goes in
that list with a `name`, `schedule`, `flag`, `enabled` and `task`.

### Choosing which crons run on a host

First rule that applies wins:

1. `CRONS_ENABLED=false` turns everything off.
2. `CRONS_DISABLED=a,b` turns the named crons off.
3. `CRONS_ONLY=a,b` turns every cron not named off.
4. Otherwise the cron's own flag decides.

The lists only ever turn crons off; naming a cron in `CRONS_ONLY` does not start
it if its own flag is off. An unknown name in either list fails start-up.

Start-up logs each cron as `on`/`off` with the reason. `GET /health` lists
disabled crons with `enabled: false` and `disabledReason`. Manually triggering a
disabled cron returns `409`.

`CRONS_ONLY` / `CRONS_DISABLED` arrived in PR #580. On a build without it they
are ignored, so production also sets `DAILY_REPORT_CRON_ENABLED=false`.

### Running on several hosts

Every job wraps its work in `withAdvisoryLock` (`src/database/advisory-lock.js`):
`GET_LOCK(name, 0)` on one pooled connection. The host that loses returns
`{ skipped: true, reason: "locked" }` and does nothing. Within one host the runner
also refuses to start a job while its previous run is still going and logs
`previous execution is still running`.

So each job has exactly one run in flight across the whole deployment. Code
inside a job can rely on that and does not need row-level concurrency tricks.

## AI DDx auto-compute pipeline

Goal: the DDx for a visit is already stored by the time a doctor opens it, so the
doctor screen reads it instead of waiting on a live AI call.

```
OpenMRS visits --visit-queue-sync--> visit_queue --ddx-worker--> AI middleware /ddx
                                                         |
                                                         v
                                               ai_ddx_results (mindmap_server)
                                                         |
                                     portal GET /api/ai-ddx/:visitUuid  <-- doctor webapp / ddx-plugin
```

### visit-queue-sync

Every run:

1. Reads every visit's current status from OpenMRS (`VISIT_STATUS_QUERY`).
2. Visits in `Awaiting Consult` or `Priority` are candidates. `Priority` becomes
   `priority = high`, everything else `normal`.
3. A candidate not already in `visit_queue` and without a `done` row in
   `ai_ddx_results` is inserted as `status = waiting`, `attempts = 0`.
4. A queued candidate whose priority changed is updated.
5. Visits now `Ended Visit` or `Completed Visit` still `waiting` are set to
   `removed`.

Its result line reads `added / updated / removed / skippedComputed / total`.

**Every awaiting visit is added as `waiting` at once. That is intended:**
`waiting` means "in the backlog", not "being called". On the first run against
production it queued the whole backlog of 855 visits; later runs only add new
visits.

### ddx-worker

Every run:

1. Puts back any `processing` row picked more than `AI_DDX_STUCK_PICKUP_MINUTES`
   ago (default 15) to `waiting`. This recovers rows from a crashed run.
2. Claims the next **N** `waiting` rows with `attempts < AI_DDX_MAX_ATTEMPTS`,
   ordered high priority first, then oldest visit first, and sets them to
   `processing`. **N is `AI_VISIT_CRON_PARALLEL_REQUEST_TO_CALL_DDX`** (default 8).
3. Calls the AI middleware `/ddx` for those rows, the same variable's count in
   parallel, each with `AI_VISIT_CRON_REQUEST_TIMEOUT` ms (default 60000).
4. Success: result stored in `ai_ddx_results` as `done`, queue row `done`.
   A visit whose case history hash is unchanged since its last `done` result is
   not re-sent.
5. Failure: error stored in `ai_ddx_results` as `failed`, queue row back to
   `waiting` with `attempts + 1`. At `AI_DDX_MAX_ATTEMPTS` (default 3) the queue
   row becomes `failed` and is never retried automatically.

`AI_DDX_WORKER_BATCH_SIZE` is **not read by any code**. Setting it does nothing.

### Queue row lifecycle

```
waiting --claim--> processing --ok--> done
   ^                   |
   |                   +--error, attempts < max--> waiting
   |                   +--error, attempts = max--> failed
   +--stuck > 15 min---+
waiting --visit ended/completed--> removed
```

Throughput is N visits per worker run. A run lasts as long as its slowest AI
call, and the next scheduled tick is skipped while one is running, so the real
rate is N per max(schedule interval, run time). At 8 per 30 s, 855 visits clear
in roughly an hour if the AI middleware keeps up.

### Admin switch

Both DDx crons check the `ai_ddx_precompute` key in the **published** AI LLM
config before doing anything. Off means each run returns
`{ skipped: true, reason: "disabled" }`.

- Fetched from `AI_LLM_CONFIG_SERVICE_URL` + `/config/getPublishedConfig`, so the
  value is the config service base including `/api`, e.g.
  `http://<config-host>:4004/api`.
- Cached 30 s. If the config service is down, the last fetched value is used.
- Missing URL, missing key, or never fetched all count as **on**. Leaving the
  URL out never stops the pipeline; it only removes the admin's ability to pause it.
- The row is created by the seeder
  `configuration-microservice/src/seeders/20261006150000-mst-ai-llm-ddx-precompute.ts`,
  shown as "AI DDx Auto-Compute" under Admin Actions -> AI LLM. Toggle changes
  apply only after **Publish**.

### Portal read side

`GET /api/ai-ddx/:visitUuid` (portal) returns the stored `done` response. Its
status lookup reports `pending` while the visit's queue row is `waiting` or
`processing`. The ddx-plugin (v1.4.3+) uses this when `ai_ddx_precompute` is on
and falls back to a live `POST /ddx` when it is off.

## Database compatibility: MySQL 5.7 / older MariaDB

Production does not run MySQL 8. Two features have already broken there:

| Feature | Needs | What happened | Replaced with |
| --- | --- | --- | --- |
| `JSON_TABLE` | MySQL 8.0.4+, never in MariaDB | daily report WhatsApp count failed | `JSON_EXTRACT` over a 0-999 number sequence (`1ca4871`) |
| `FOR UPDATE SKIP LOCKED` | MySQL 8.0.1+ / MariaDB 10.6+ | `ddx-worker` failed every run, nothing left `waiting` | plain `FOR UPDATE`; the advisory lock already makes the claim single-writer |

Before adding SQL to any cron or portal query, avoid these unless the target
version is confirmed with `SELECT VERSION();`:

- `SKIP LOCKED`, `NOWAIT`
- `JSON_TABLE`, `JSON_ARRAYAGG` / `JSON_OBJECTAGG` (5.7.22+ only)
- CTEs (`WITH ...`, `WITH RECURSIVE`)
- window functions (`ROW_NUMBER() OVER`, `RANK()`, ...)
- `LATERAL`, `REGEXP_REPLACE` / `REGEXP_SUBSTR`

Tests mock the database, so they cannot catch this. The SKIP LOCKED fix adds a
test asserting the claim query stays portable; do the same for new queries that
were tempted by one of the above.

## Deploying the pipeline to a new environment

1. Portal migrations: `visit_queue` and `ai_ddx_results`.
2. Config seeder, **on its own**. Seeders here are not tracked (no
   `SequelizeData` table), so `db:seed:all` re-runs every seeder and fails on
   rows that already exist:
   ```
   cd configuration-microservice
   npm run build
   npx sequelize db:seed --seed 20261006150000-mst-ai-llm-ddx-precompute.js
   ```
3. Admin Actions -> AI LLM: turn "AI DDx Auto-Compute" on, **Publish**.
4. Cron service env (auto-compute only):
   ```
   CRONS_ENABLED=true
   CRON_TIMEZONE=Asia/Kolkata
   CRONS_ONLY=visit-queue-sync,ddx-worker
   DAILY_REPORT_CRON_ENABLED=false

   AI_DDX_PIPELINE_ENABLED=true
   AI_VISIT_CRON_TIMINGS_DDX_QUEUE=*/30 * * * * *
   AI_VISIT_CRON_TIMINGS_DDX_CALL=*/30 * * * * *
   AI_VISIT_CRON_REQUEST_TIMEOUT=60000
   AI_VISIT_CRON_PARALLEL_REQUEST_TO_CALL_DDX=8
   AI_DDX_MAX_ATTEMPTS=3
   AI_DDX_STUCK_PICKUP_MINUTES=15

   AI_MIDDLEWARE_BASE_URL=<ai-middleware-url>
   AI_MIDDLEWARE_API_KEY=<ai-middleware-api-key>
   AI_LLM_CONFIG_SERVICE_URL=http://<config-host>:4004/api

   HEALTHCHECK_TOKEN=<random-token>
   CRON_TRIGGER_TOKEN=
   ```
   Plus the usual `MYSQL_*` settings. An empty `CRON_TRIGGER_TOKEN` keeps the
   manual-run endpoint switched off.
5. Check the start-up log shows `on visit-queue-sync`, `on ddx-worker`,
   `off daily-operations-report`, and that `waiting` rows start turning `done`.

## Checking on it

```sql
SELECT status, COUNT(*) FROM visit_queue GROUP BY status;
SELECT status, COUNT(*) FROM ai_ddx_results GROUP BY status;
SELECT visit_uuid, attempts, error FROM ai_ddx_results WHERE status = 'failed' ORDER BY updatedAt DESC LIMIT 20;
```

- All rows `waiting` and nothing `processing` / `done`: the worker is failing
  before it claims. Check the cron log for `[cron:ddx-worker]` errors.
- Rows stuck in `processing`: a run died mid-way; they return to `waiting` after
  `AI_DDX_STUCK_PICKUP_MINUTES`.
- `failed` queue rows are not retried. After fixing the cause, requeue with
  `UPDATE visit_queue SET status = 'waiting', attempts = 0 WHERE status = 'failed';`

## PR trail

| PR | Repo | What |
| --- | --- | --- |
| #578 (merged) | backend-service | pipeline: migrations, both crons, portal `/ai-ddx`, seeder |
| #580 | backend-service | `CRONS_ONLY` / `CRONS_DISABLED`, disabled crons visible |
| (pending) | backend-service | drop `SKIP LOCKED` from the worker claim |
| #4 | doctor-ddx-plugin | read stored DDx when precompute is on, live `/ddx` otherwise (v1.4.3) |
| #1142 | doctor-webapp | treat `/ai-ddx/` polling errors separately; aiddx-library v1.4.3 |
