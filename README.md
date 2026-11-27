# Intelehealth Backend Microservices

This repository holds the backend services of the Intelehealth telehealth platform. Each service
lives in its own top-level folder with its own `package.json`, `Dockerfile` and environment file.
The services are mostly Express (JavaScript) apps on Sequelize and MySQL. `web-rtc` and
`configuration-microservice` are TypeScript.

## Services

| Folder | Purpose | Default port | Runtime | Start |
| --- | --- | --- | --- | --- |
| `portal` | Main API (package `mindmapbackend`): auth, OpenMRS proxy, appointments, messages, notifications, Socket.IO, AI diagnosis proxy, voicedoc, support. | 3004 | Node, Express | `npm start` (`bin/www`) |
| `auth-gateway` | Login and token service for the other APIs. Runs under PM2 in cluster mode (`ecosystem.config.js`). | 3000 (Docker image exposes 3030) | Node, Express | `npm start` (`bin/www`) |
| `web-rtc` | Video call backend: LiveKit rooms and recordings, call status, magic links, WhatsApp call links, QMS webhooks. | 3000 | Node, TypeScript | `npm start` (`ts-node src/index.ts`) |
| `configuration-microservice` | Configuration API (features, themes, languages, sidebar, dropdowns, visit sections, AI/LLM settings, and more). | 4004 (Docker image; the app reads `PORT`) | Node, TypeScript | `npm run build`, then `npm start` |
| `cron-microservice` | In-process scheduler with its own health server: daily operations report, visit queue sync, DDx worker. | 3010 | Node 20, plain `http` | `npm start` (`src/index.js`) |
| `pagerduty-microservice` | Creates PagerDuty tickets and keeps them in the `pagerduty_tickets` table. | 3000 | Node, Express | `npm start` (`bin/www`) |
| `mobilab-microservice` | Mobilab integration: auth, booking, catalog, clinic, report and user routes. No database. | 3070 | Node, Express | `npm start` (`bin/www`) |
| `abha` | ABHA/ABDM integration (enrolment, login, care-context linking). | 3060 | Node, Express | `npm start` (`bin/www`) |

Ports are the defaults in `bin/www`, `src/index.ts`, `src/http-server.js` or the `Dockerfile`.
Set `PORT` to change them.

There is no `queue-microservice` folder in this repository. `.github/workflows/qms.yml` builds an
image from a `queue-microservice/` folder (or a root `Dockerfile`) on the branch
`development_master_qms_service`. `web-rtc` and `cron-microservice` talk to the queue service, but its
code is not on the branches described here.

## Requirements

- MySQL. `portal`, `auth-gateway`, `web-rtc`, `configuration-microservice`, `cron-microservice`,
  `pagerduty-microservice` and `abha` connect to it. `portal`, `cron-microservice`,
  `abha` and `configuration-microservice` also read an OpenMRS database (`MYSQL_OPENMRS_DB`).
  `pagerduty-microservice` reads an OpenMRS database too, with the name `openmrs` fixed in code.
- Node.js and npm:

| Service | Dockerfile base image | `engines` | `.nvmrc` |
| --- | --- | --- | --- |
| `portal` | `node:18-alpine` | node >=18 | `v20.15.0` |
| `auth-gateway` | `node:18-alpine` | node >=18 | `v20.15.0` |
| `web-rtc` | `node:18-alpine` | node >=18 | none |
| `configuration-microservice` | `node:18-alpine` | node >=18 | none |
| `cron-microservice` | `node:20-alpine` | node >=20 | none |
| `mobilab-microservice` | `node:18-alpine` | node >=18 | `v20.15.0` |
| `pagerduty-microservice` | no Dockerfile | node >=18 | none |
| `abha` | no Dockerfile | none | `v14.20.0` |

- Docker, only to build the images the deploy workflows build.
- The root `package.json` installs husky and commitlint for the commit message hook. Run `npm install`
  in the repository root once.

## Running a service locally

1. Install and configure the service you want to run:

```bash
cd <service>
npm install
cp example.env .env
```

2. Edit `.env`. Use your own local values. See [Environment variables](#environment-variables).
3. Start it:

| Service | Development | Production-style |
| --- | --- | --- |
| `portal` | `npm run dev` (nodemon) | `npm start` |
| `auth-gateway` | `npm run dev` | `npm start` |
| `web-rtc` | `npm run dev` | `npm start` |
| `configuration-microservice` | `npm run dev` | `npm run build && npm start` |
| `cron-microservice` | `npm run dev` (`node --watch`) | `npm start` |
| `pagerduty-microservice` | `npm run dev` | `npm start` |
| `mobilab-microservice` | `npm run dev` | `npm start` |
| `abha` | `npm run dev` | `npm start` |

4. Check it with `GET /health` (see [Service health APIs](#service-health-apis)).

Notes that differ per service:

- `configuration-microservice` has no `example.env`. Outside production it loads `env/<name>.env`
  (default `env/development.env`, relative to the service folder). In production it loads `.env`. Its keys
  are listed below.
- `cron-microservice`: `npm run migrate` applies its own SQL migrations (see Database). Use
  `npm run cron:daily-report:preview` to render a sample report without a database.
  `cron-microservice/README.md` documents its cron switches.
- `pagerduty-microservice` has no `example.env`. Its keys are listed below.
- `portal` also has `cron_server.js`, which is not started by `npm start`.
- `portal/README.md` covers the AI diagnosis proxy and precomputed DDx. `configuration-microservice/README.md`
  and `configuration-microservice/CONFIG_SCRIPTS.md` cover that service.

## Database

- Database credentials come from environment variables. Never commit a password in a `config.json`.
- `portal`, `cron-microservice`, `abha`, `auth-gateway` and `web-rtc` default `MYSQL_DB` to
  `mindmap_server`. Whether the services share one database depends on the `MYSQL_DB` you set.
- `auth-gateway` and `pagerduty-microservice` connect at runtime with the `MYSQL_*` variables, but the
  Sequelize CLI reads `config/config.json` for them. Keep the committed `config.json` files free of
  real passwords and hosts, and put local values in your own copy.
- Migrations live in each service's `migrations/` folder, except `web-rtc` (`src/migrations`) and
  `configuration-microservice` (`src/migrations`, compiled to `dist/src/migrations`):

| Service | Migrations | Command |
| --- | --- | --- |
| `portal` | `migrations/` | `npm run migrate` |
| `auth-gateway` | `migrations/` | `npm run migrate` (reads `config/config.json`) |
| `web-rtc` | `src/migrations/` | `npm run migrate` |
| `configuration-microservice` | `src/migrations/` | `npm run build`, then `npm run migrate` (runs the compiled files in `dist`) |
| `cron-microservice` | `src/database/migrations/` | `npm run migrate` (own runner, table `schema_migrations`) |
| `pagerduty-microservice` | `migrations/` | no script; run `npx sequelize db:migrate` (reads `config/config.json`) |
| `abha` | `migrations/` | no script, no Sequelize config in the folder |

- `portal`, `auth-gateway`, `web-rtc` and `configuration-microservice` use Sequelize CLI, which
  records applied migrations in the `SequelizeMeta` table of the database it connects to. Services
  that connect to the same database therefore share one `SequelizeMeta`. Check the `MYSQL_DB` value
  of each service before you run a migration.
- Only `configuration-microservice` has seeders (`src/seeders/`). Seeders are not idempotent.
  Run one seeder by name and never run `db:seed:all` (which is what `npm run seed` does):

```bash
cd configuration-microservice
npm run build
npx sequelize db:seed --seed <timestamp>-<name>.js
```

- `npm run build` in `configuration-microservice` empties `dist` first. Do not run it on a deployed
  server: it removes files that only exist there, such as key files and the published config.
- No workflow in `.github/workflows` runs migrations or seeders. The only mention is a commented-out
  `npm run migrate` step in `cron-microservice-deploy.yml`. Run migrations by hand on each
  environment, before or with the deploy that needs them.

## Tests

| Service | Command |
| --- | --- |
| `portal` | `npm test` (`node --test test/`) |
| `cron-microservice` | `npm test` (`node --test src/**/*.test.js`) |
| `configuration-microservice` | `npm test` (nodemon, hot reload) or `npm run test:no-reloading`; lint with `npm run lint` |

The other services have no test script. `mobilab-microservice` has `npm run lint`. The
`cron-microservice` deploy workflow runs `npm test` on Node 20 before building the image.

## Service health APIs

Every service except `abha` exposes two lightweight, unauthenticated-by-default probe endpoints:

- `GET /health` checks only that the service process is online. It does not contact MySQL.
- `GET /ready` checks every MySQL database used by that service. It returns HTTP `200` when all
  connections succeed and HTTP `503` otherwise.

Readiness results are cached for five seconds and concurrent requests share one database check. Set
`HEALTHCHECK_CACHE_TTL_MS` to customize the cache between 1,000 and 60,000 milliseconds.

For networks where probe endpoints are not isolated, set `HEALTHCHECK_TOKEN`. Clients must then send
either `X-Healthcheck-Token: <token>` or `Authorization: Bearer <token>`. Token comparison is
constant-time, responses do not expose database errors or connection details, and all probe responses
use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

## Deployment

Deployments are owned by DevOps. Workflows are in `.github/workflows`. Each builds a Docker image
and deploys it to the selected hosts over SSH. Host names, users and keys are repository secrets.

| Workflow | Service | Runs on a push that changes |
| --- | --- | --- |
| `portal-deploy.yml` | `portal` | `portal/**` |
| `auth-gateway-deploy.yml` | `auth-gateway` | `auth-gateway/**` |
| `web-rtc-deploy.yml` | `web-rtc` | `web-rtc/**` |
| `cron-microservice-deploy.yml` | `cron-microservice` | `cron-microservice/**` |

- Manual runs (`workflow_dispatch`) choose the hosts with checkboxes.
- A change to a workflow file also triggers that workflow.
- `configuration-microservice`, `pagerduty-microservice`, `mobilab-microservice` and `abha` have no
  workflow in this repository.
- Which branch deploys to which server is in [Branches and pull requests](#branches-and-pull-requests).
  The list of hosts for each branch is set inside each workflow file.

## Environment variables

Each service reads its variables from `.env` in its folder (see the exceptions above). The key
names below come from each service's `example.env` and from where the code reads `process.env`.
Never commit a `.env` file, keys or certificates. Values are not listed here. Ask the team for
development values.

Keys shared by several services: `NODE_ENV`, `PORT`, `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DIALECT`,
`MYSQL_USERNAME`, `MYSQL_PASS`, `MYSQL_DB`, `ALLOWED_ORIGINS`, `SSL_CERT_PATH`, `SSL_KEY_PATH`,
`HEALTHCHECK_TOKEN`, `HEALTHCHECK_CACHE_TTL_MS`.

### portal

| Key | Purpose |
| --- | --- |
| `NODE_ENV`, `DOMAIN`, `ALLOWED_ORIGINS` | Environment name, public domain, allowed CORS origins. |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DIALECT`, `MYSQL_USERNAME`, `MYSQL_PASS`, `MYSQL_DB` | Portal database connection. |
| `MYSQL_OPENMRS_DB` | OpenMRS database name. |
| `OPENMRS_USERNAME`, `OPENMRS_PASS` | OpenMRS login. |
| `APIKEY_2FACTOR` | SMS/OTP provider key. |
| `OPEN_AI_KEY`, `OPEN_AI_BASE_URL` | OpenAI access. |
| `AI_MIDDLEWARE_BASE_URL`, `AI_MIDDLEWARE_API_KEY` | AI middleware used by the diagnosis proxy. |
| `AI_DDX_NOTIFY_TOKEN` | Token shared with `cron-microservice`; the notify route returns 404 while blank. |
| `MAIL_USERNAME`, `MAIL_PASSWORD`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_CLIENT_REFRESH_TOKEN` | Outgoing mail (OAuth). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_MAILTO` | Web push. |
| `FIREBASE_DB_URL`, `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME`, `AWS_URL` | S3 storage. |
| `DR_SIGN_AWS_ACCESS_KEY_ID`, `DR_SIGN_AWS_SECRET_ACCESS_KEY`, `DR_SIGN_AWS_REGION`, `DR_SIGN_AWS_BUCKET_NAME`, `DR_SIGN_AWS_URL` | S3 storage for doctor signatures. |
| `SSL_PRIVATE_KEY`, `SSL_CERT` | TLS key and certificate. |
| `SLACK_AI_ISSUE_WEBHOOK_URL` | Slack webhook for AI issue reports. |
| `DOCTOR_WEBAPP_URL` | Doctor web app URL. |
| `HEALTHCHECK_TOKEN`, `HEALTHCHECK_CACHE_TTL_MS` | Optional health API token and cache time. |
| `ACHIEVEMENTS_TZ_OFFSET_MINUTES`, `ACHIEVEMENTS_MAX_RANGE_DAYS`, `HEARTBEAT_MAX_SECONDS` | Optional achievements and activity heartbeat limits. |
| `VOICEDOC_EMAIL`, `VOICEDOC_PASSWORD` | Voicedoc login. |

### auth-gateway

| Key | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT`, `DOMAIN`, `ALLOWED_ORIGINS` | Environment, port, domain, CORS origins. |
| `JWT_SECRET` | Token signing secret. |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DIALECT`, `MYSQL_USERNAME`, `MYSQL_PASS`, `MYSQL_DB` | Database connection. |
| `DOCTOR_ROLES`, `NURSE_ROLES`, `MCC_ROLES` | Role names used when issuing tokens. |
| `PHONE_NUMBER_PROVIDER_ATTRIBUTE_TYPE`, `COUNTRY_CODE_PROVIDER_ATTRIBUTE_TYPE`, `EMAIL_PROVIDER_ATTRIBUTE_TYPE` | OpenMRS provider attribute types read at login. |
| `SSL_KEY_PATH`, `SSL_CERT_PATH` | TLS key and certificate paths. |
| `HEALTHCHECK_TOKEN`, `HEALTHCHECK_CACHE_TTL_MS` | Optional health API token and cache time. |

### web-rtc

| Key | Purpose |
| --- | --- |
| `PORT`, `SECRET`, `API_KEY` | Port, service secret, API key. |
| `SSL`, `SSL_CERT_PATH`, `SSL_KEY_PATH` | TLS switch and file paths. |
| `LIVEHOST`, `TCP`, `UDP` | Media server host and ports. |
| `BRANDNAME`, `DOMAIN` | Brand and domain, used in recording paths. |
| `SENTRY_DSN` | Error reporting. |
| `MYSQL_DB`, `MYSQL_USERNAME`, `MYSQL_PASS`, `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DIALECT` | Database; read at runtime and by the migration CLI. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` | Call recording storage. |
| `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ALERT_RECIPIENT` | Recording failure alert email. |
| `LIVEKIT_ROOM_HOST`, `HW_WEBAPP_URL` | Video call join (magic) links. |
| `IS_TURN_SERVER` | Master switch for the WhatsApp appointment call link feature; the keys below are unused while it is unset. |
| `PUBLIC_BASE_URL` | Public base URL of this service, used in the WhatsApp link. |
| `TURN_CALL_LINK_ENABLED`, `TURN_CALL_LINK_CRON`, `TURN_CALL_LINK_LEAD_MINUTES`, `TURN_CALL_LINK_GRACE_MINUTES`, `TURN_CALL_LINK_STALE_MINUTES`, `TURN_CALL_LINK_MAX_ATTEMPTS`, `TURN_CALL_LINK_OPEN_BEFORE_MINUTES`, `TURN_CALL_LINK_OPEN_AFTER_MINUTES`, `TURN_CALL_LINK_TTL_MINUTES` | Timing and switches for the automatic call link send. |
| `TURN_API_TOKEN`, `TURN_API_URL`, `TURN_DRY_RUN` | WhatsApp API access; dry run logs the payload and sends nothing. |
| `TURN_APPOINTMENT_TEMPLATE_NAME`, `TURN_APPOINTMENT_TEMPLATE_NAMESPACE`, `TURN_APPOINTMENT_TEMPLATE_LANG` | Approved WhatsApp template. |
| `OPENMRS_REST_URL`, `OPENMRS_USERNAME`, `OPENMRS_PASSWORD`, `OPENMRS_PHONE_ATTRIBUTE` | OpenMRS REST access to find the patient's number. |
| `CONFIG_URL` | Configuration-microservice base URL; the `qms_section` feature flag is read from it. |
| `QMS_BASE_URL`, `QMS_SERVICE_SECRET`, `QMS_TIMEOUT_MS` | Queue service webhooks. Inert while `qms_section` is off. |
| `HEALTHCHECK_TOKEN`, `HEALTHCHECK_CACHE_TTL_MS` | Optional health API token and cache time. |

### configuration-microservice

No `example.env`. Keys read in `src/constants/EnvVars.ts`:

| Key | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT` | Environment and port. |
| `COOKIE_SECRET`, `COOKIE_PATH`, `COOKIE_EXP`, `COOKIE_DOMAIN`, `SECURE_COOKIE` | Session cookie settings. |
| `JWT_SECRET` | Token signing secret. |
| `MYSQL_DIALECT`, `MYSQL_PORT`, `MYSQL_HOST`, `MYSQL_USERNAME`, `MYSQL_PASS`, `MYSQL_DB`, `MYSQL_OPENMRS_DB` | Database connections. |
| `SSL_PRIVATE_KEY`, `SSL_CERT`, `PEM_FOLDER_PATH` | TLS key, certificate and key folder. |
| `ALLOWED_ORIGINS` | Allowed CORS origins. |

### cron-microservice

| Key | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT` | Environment and port. |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USERNAME`, `MYSQL_PASS`, `MYSQL_DB`, `MYSQL_POOL_SIZE`, `MYSQL_OPENMRS_DB` | Portal and OpenMRS database pools. |
| `AWS_REGION`, `AWS_BUCKET_NAME` | S3 settings. |
| `WEBRTC_RECORDINGS_S3_BUCKET`, `WEBRTC_RECORDINGS_S3_PREFIX`, `KALEYRA_RECORDINGS_S3_BUCKET`, `KALEYRA_RECORDINGS_S3_PREFIX` | Recording buckets and prefixes counted by the daily report. |
| `GA_PROPERTY_ID`, `GA_PROPERTY_TIMEZONE`, `GA_HOSTNAME`, `GA_SERVICE_ACCOUNT_JSON`, `DAILY_REPORT_GA_METRICS` | Google Analytics metrics for the daily report. |
| `CRONS_ENABLED`, `CRONS_ONLY`, `CRONS_DISABLED`, `CRON_TIMEZONE` | Which crons run on this host, and their timezone. |
| `DAILY_REPORT_CRON_ENABLED`, `DAILY_REPORT_CRON`, `DAILY_REPORT_DB_METRICS`, `DAILY_REPORT_S3_METRICS` | Daily report switch, schedule and metric groups. |
| `SLACK_DAILY_REPORT_WEBHOOK_URL` | Slack webhook; leave unset to skip posting. |
| `CRON_TRIGGER_TOKEN` | Token for manual trigger requests. |
| `AI_DDX_PIPELINE_ENABLED` | Switch for the visit queue and DDx worker crons. |
| `AI_VISIT_CRON_TIMINGS_DDX_QUEUE`, `AI_VISIT_CRON_TIMINGS_DDX_CALL`, `AI_VISIT_CRON_REQUEST_TIMEOUT`, `AI_VISIT_CRON_PARALLEL_REQUEST_TO_CALL_DDX` | DDx schedules, timeout and parallelism. |
| `AI_DDX_NOTIFY_URL`, `AI_DDX_NOTIFY_TOKEN` | Portal notify endpoint and the token shared with it. |
| `AI_MIDDLEWARE_BASE_URL`, `AI_MIDDLEWARE_API_KEY`, `AI_LLM_CONFIG_SERVICE_URL` | AI middleware and LLM config service. |
| `HEALTHCHECK_TOKEN`, `HEALTHCHECK_CACHE_TTL_MS` | Optional health API token and cache time. |

### pagerduty-microservice

No `example.env`. Keys read in code.

| Key | Purpose |
| --- | --- |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DIALECT`, `MYSQL_USERNAME`, `MYSQL_PASS`, `MYSQL_DB` | Database connection. |
| `PAGERDUTY_API_TOKEN` | PagerDuty API token. |
| `PAGERDUTY_ESCALATION_POLICY_ID`, `PAGERDUTY_JIRA_SERVICE_ID` | PagerDuty escalation policy and Jira service. |
| `HIGH_PRIORITY_ID`, `MEDIUM_PRIORITY_ID`, `LOW_PRIORITY_ID` | PagerDuty priority ids. |
| `ALLOWED_ORIGINS` | Allowed CORS origins. |
| `HEALTHCHECK_TOKEN`, `HEALTHCHECK_CACHE_TTL_MS` | Optional health API token and cache time. |

### mobilab-microservice

| Key | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT`, `ALLOWED_ORIGINS` | Environment, port, CORS origins. |
| `SSL_CERT_PATH`, `SSL_KEY_PATH` | TLS paths. |
| `AUTH_GATEWAY_URL` | Auth gateway URL, used by the Swagger login helper. |
| `MOBILAB_BASE_URL`, `MOBILAB_API_KEY`, `MOBILAB_CLIENT_ID`, `MOBILAB_CLIENT_SECRET`, `MOBILAB_SCHEMA_NAME` | Mobilab external API. |
| `MOBILAB_UPLOAD_MAX_MB`, `MOBILAB_TIMEOUT_MS` | Upload size limit and request timeout. |
| `HEALTHCHECK_TOKEN` | Optional health API token. |

### abha

| Key | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT`, `DOMAIN`, `SSL_CERT_PATH`, `SSL_KEY_PATH` | Environment, port, domain, TLS paths. |
| `CLIENT_ID`, `CLIENT_SECRET`, `X_CM_ID` | ABDM client credentials and consent manager id. |
| `ALLOWED_ORIGINS` | Allowed CORS origins. |
| `ABDM_INTELEHEALTH_ID`, `ABHA_ADDRESS_SUFFIX` | ABDM identifiers. |
| `SESSION_TOKEN_GEN_URL`, `PUBLIC_KEY_GEN_URL`, `ENCYPTED_DATA_URL`, `REQ_OTP_URL`, `MOBILE_OTP_URL`, `ENROLL_AADHAR_BY_URL`, `ENROLL_SUGGESION_URL`, `SET_PREFERED_ADDRESS_URL`, `LOGIN_VERIFY_URL`, `LOGIN_VERIFY_USER_URL`, `ACCOUNT_VERIFY_USER_URL`, `GET_CARD_URL`, `SEARCH_ABHA_NUMBER_BY_MOBILE`, `ENROLL_BY_ABDM_URL`, `ABHA_FETCH_AUTH_MODE_URL` | ABDM endpoint URLs (the key spellings are as in `example.env`). |
| `ABHA_ADDRESS_OTP_URL`, `ABHA_ADDRESS_OTP_VERIFY`, `ACCOUNT_VERIFY_ABHA_USER_URL`, `ABHA_ADDRESS_GET_CARD_URL` | ABHA address (M1 v3) endpoint URLs. |
| `POST_LINK_CARE_CONTEXT_URL`, `POST_LINK_CARE_CONTEXT_STATUS_URL`, `POST_SMS_NOTIFY_URL` | ABDM wrapper endpoint URLs. |
| `OPENMRS_USERNAME`, `OPENMRS_PASS`, `MYSQL_OPENMRS_DB` | OpenMRS login and database name. |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DIALECT`, `MYSQL_USERNAME`, `MYSQL_PASS` | Database connection. |
| `DEVGLAN_CRYPTO_API_KEY`, `ENABLE_LOCAL_CRYPTO` | Text encryption service key and local-crypto switch. |

A new variable must be added in two places: the service's `example.env` (or its table above, where
there is no `example.env`) and the table for that service in this README.

## Development Standards

This is a first, lightweight set of standards. It will grow over time. When in doubt, follow the
pattern the surrounding code in that service already uses.

### Branches and pull requests

| Branch | Role | Deploys to |
| --- | --- | --- |
| `development_master` | Testing only. May hold unstable changes. | dev, ttxai, testturn |
| `staging_master` | Stable base. Every branch starts here and returns here. | nasstaging, pathqa |
| `production_master` | Takes code from `staging_master`. | staging server |
| `master` | Takes code from `staging_master` or `production_master`. | demoai |
| `nas_production_master` | Cut from `production_master`. | NAS production |
| `ap_production_master` | Cut from `production_master`. | Arogya Path production |

The staging server, demoai and the two production servers are being moved onto these branches by
DevOps; until then they keep their current triggers.

**Flow**

1. Cut your branch from `staging_master`. Name it `<type>/<ticket>-<short-description>` with type
   `feature`, `fix` or `patch`, e.g. `fix/ayu-46-manual-ai-wrappers`, `feature/cron-manual-trigger`.
2. Open a PR into `development_master` and test the change on the dev server.
3. Once tested, open a PR from the **same branch** into `staging_master`.
4. `staging_master` is merged into `production_master` and `master` when a release is ready.

**Rules**

- Never merge `development_master` into `staging_master`, `production_master` or `master`. It can
  contain unstable testing changes.
- Never cut a branch from `development_master`. A branch must carry only stable code plus its own change.
- If testing on dev finds a problem, fix it on your branch and merge the branch into
  `development_master` again. Do not commit the fix on `development_master` only.
- Merges from `staging_master` into `production_master` or `master` use **"Create a merge commit"**, never squash.
- `development_master` may be reset to `staging_master` with a force push to make the dev branch
  stable again. This discards every testing change that is on `development_master` only, so it is
  the Tech Lead's decision alone. Before a reset, make sure your work is on your own branch.
- Keep a PR to one logical change, in one service where possible. Describe what changed and why,
  and call out any migration or new environment variable.
- Do not merge your own PR without a review.

### Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). The husky `commit-msg`
hook runs commitlint (`.commitlintrc.json`) and rejects anything else. Run `npm install` in the
repository root so husky installs the hook.

Allowed types: `feat`, `fix`, `perf`, `refactor`, `style`, `docs`, `chore`, `ci`, `revert`.

```
fix: allow provided config object to extend other configs
feat(lang): add language data
revert!: drop Node 12 from testing matrix
```

Keep the subject short and in the imperative ("add", not "added"). Use the service name as the
scope when it helps, e.g. `feat(portal): ...`.

### Service structure

Each Express service (`portal`, `auth-gateway`, `pagerduty-microservice`, ...) uses the same
layers. Keep each layer to its job:

| Layer         | File                                   | Responsibility                                 |
| ------------- | -------------------------------------- | ---------------------------------------------- |
| Route         | `routes/<feature>.route.js`            | Path, HTTP method, middleware. No logic.       |
| Controller    | `controllers/<feature>.controller.js`  | Read and validate input, call the service, respond. |
| Service       | `services/<feature>.service.js`        | Business logic and database or external calls. |
| Model         | `models/<table_name>.js`               | Sequelize model definition.                    |
| Migration     | `migrations/<YYYYMMDDHHMMSS>-<desc>.js` | Every schema change.                           |

- Register new route files in `routes/index.js`.
- File names are `kebab-case`, except model files, which use the `snake_case` table name.
- `web-rtc` and `configuration-microservice` are TypeScript. Follow their `src/` layout and
  `tsconfig.json`.

### Database

- Change the schema only through a migration (`npm run migrate`). Never use `sync({ alter })` or
  hand-run `ALTER` statements.
- A migration must have a working `down`.
- Use Sequelize queries with bound parameters. Never build SQL by concatenating strings.
- Never commit database passwords in `config.json`. Read credentials from environment variables.

### Responses and errors

- In `portal`, respond with `RES(res, { success, data | message }, statusCode)` from
  `handlers/helper.js`, and use proper status codes (`422` for bad input, `401`/`403` for auth,
  `500` for unexpected errors).
- User-facing messages go in `constants/messages.js` (`MESSAGE`). Other constants go in
  `constants/constant.js` with `UPPER_SNAKE_CASE` keys.
- Wrap `async` handlers in `try/catch`. Do not leave a promise unhandled.
- Never return stack traces, SQL errors or connection details to the client.

### Auth

- Auth is applied per route. Add `authMiddleware` (`middleware/auth.js`) to every new route, e.g.
  `router.get("/x", [authMiddleware, handler])`. Add `middleware/is-admin.js` as well for
  admin-only routes.
- A route that must be public needs a reason in the PR. `IGNORED_ROUTES.js` skips the token check
  for a path even when `authMiddleware` is applied, so add to it only when there is no other
  option.

### Logging

- Use the service's logger (`logStream` from `logger/`) instead of `console.log`.
- Never log patient data, passwords, OTPs, tokens or API keys.

### Environment variables

A new variable must be added in two places: the service's `example.env` and that service's table in
[Environment variables](#environment-variables). Never commit `.env`, keys or certificates.

### Tests

Add tests to any service that already has a test harness: `portal` (`npm test`), `cron-microservice`
(`npm test`) and `configuration-microservice` (`npm test`, `npm run lint`). Run them before opening
the PR.
