# queue-microservice (QMS)

Specialty-wise patient queue for the Intelehealth telemedicine platform.
Lightweight Express + Sequelize + MySQL. No sockets — status is driven by the
WebRTC call lifecycle and clients poll the read endpoints.

## Run

```bash
cp .env.example .env   # fill in DB creds + QMS_SERVICE_SECRET
npm install
npm run migrate        # create/upgrade the schema (see below)
npm start              # or: npm run dev
```

**API docs (Swagger):** `http://localhost:<PORT>/api-docs` — click **Authorize** and
paste your `QMS_SERVICE_SECRET` to try the endpoints.

## Migrations (sequelize-cli)

Same setup as `web-rtc`: `.sequelizerc` → `src/config/config.cli.js` (reads the same
`DB_*` env vars), migration files in `src/migrations/`.

```bash
npm run migrate         # apply pending migrations  (sequelize db:migrate)
npm run migrate:status  # show applied / pending
npm run migrate:undo    # roll back the last migration
```

**Run migrations as a separate deploy step — do NOT bake them into `start`.** Reasons:
if you run multiple app instances, each start would race to migrate the same DB; a
half-finished deploy could run the app against a half-migrated schema. Your CI/deploy
should do: `npm ci → npm run migrate → npm start` (or a `predeploy` hook), exactly like
`web-rtc`'s standalone `migrate` script.

`DB_SYNC=true` exists only as a **dev shortcut** to auto-create the table from the model
without migrations. Keep it `false` everywhere else and rely on `npm run migrate`.

### Seed data (optional)

`npm run seed` runs any seeders in `src/seeders/`. Add a seeder if you want sample
queue entries for local testing — ask and one can be generated.

## Table DDL

```sql
CREATE TABLE queue_entries (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  visitUuid    VARCHAR(255) NOT NULL,
  patientId    VARCHAR(255),
  patientName  VARCHAR(255),
  specialty    VARCHAR(255) NOT NULL,
  status       ENUM('WAITING','ASSIGNED','IN_CALL','COMPLETED','CANCELLED','STALE') DEFAULT 'WAITING',
  priority     INT DEFAULT 0,
  doctorId     VARCHAR(255),
  roomId       VARCHAR(255),
  enqueuedAt   DATETIME,
  assignedAt   DATETIME,
  startedAt    DATETIME,
  completedAt  DATETIME,
  createdAt    DATETIME NOT NULL,
  updatedAt    DATETIME NOT NULL,
  UNIQUE KEY uq_visit (visitUuid),
  KEY idx_specialty_status_order (specialty, status, priority, enqueuedAt)
) ENGINE=InnoDB;   -- InnoDB required for FOR UPDATE SKIP LOCKED
```

> **Requires MySQL 8.0.1+** for `SKIP LOCKED`. On 5.7, replace `claimNext` with the
> conditional-UPDATE + retry approach (see `claimById`).

## Authentication

Same scheme as the other Intelehealth services (portal, web-rtc, pagerduty). Every
`/queue/*` route requires **one of**:

1. **User JWT** — `Authorization: Bearer <token>`, signed by OpenMRS/auth and verified
   with the shared RSA public key. Used by the doctor / patient / health-worker apps.
   → **Copy the same `public_key.pem` used by the other services into
   `queue-microservice/.pem/public_key.pem`.** (`.pem/` is gitignored — never commit it.)
2. **Service secret** — `x-qms-secret: <QMS_SERVICE_SECRET>` header. For internal
   backend callers (web-rtc, portal) that have no user token.

`/health` and `/api-docs` are public. Auth logic: `src/middleware/auth.js`.

## Endpoints

| Method | Path | Caller | Purpose |
|--------|------|--------|---------|
| POST | `/queue` | health worker / middleware | enqueue `{visitUuid, patientId, patientName, specialty, priority?}` |
| GET  | `/queue/:specialty/next?doctorId=` | doctor | atomically claim next waiting patient (SKIP LOCKED) |
| POST | `/queue/:id/claim` | doctor | claim a specific entry; falls back to next if already taken |
| POST | `/queue/in-call` | web-rtc (startRecording) | `{visitUuid, doctorId, roomId}` → IN_CALL |
| POST | `/queue/complete` | web-rtc (stopRecording/webhook) | `{visitUuid}` → COMPLETED |
| GET  | `/queue/busy/:visitUuid` | web-rtc | is this visit already in a call? |
| GET  | `/queue/position/:visitUuid` | patient app | position + estimated wait |
| GET  | `/queue/:specialty` | doctor / health worker board | pending list + counts (poll every 5–10s) |

## Feature flag (host services only)

This standalone service needs no flag — if unwanted, don't deploy it. But any QMS
code added to **existing** services (web-rtc, portal) must be gated:

- `QMS_ENABLED` — default OFF (absent or `!== 'true'` → disabled)
- `QMS_BASE_URL`, `QMS_SERVICE_SECRET`
- calls must be **fire-and-forget** — a QMS outage must never break the host flow.

See `web-rtc/src/services/qms.integration.ts` for the reference helper.
