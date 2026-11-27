# Doctor-WebApp-Mindmap-Service

## Service health APIs

Every microservice exposes two lightweight, unauthenticated-by-default probe
endpoints:

- `GET /health` checks only that the service process is online. It does not
  contact MySQL.
- `GET /ready` checks every MySQL database used by that service. It returns
  HTTP `200` when all connections succeed and HTTP `503` otherwise.

Readiness results are cached for five seconds and concurrent requests share one
database check. Set `HEALTHCHECK_CACHE_TTL_MS` to customize the cache between
1,000 and 60,000 milliseconds.

For networks where probe endpoints are not isolated, set `HEALTHCHECK_TOKEN`.
Clients must then send either `X-Healthcheck-Token: <token>` or
`Authorization: Bearer <token>`. Token comparison is constant-time, responses
do not expose database errors or connection details, and all probe responses
use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites
Node.js
   ```
   https://nodejs.org/en/
   ```
   
    
### Installing
A step by step series of examples that tell you how to get a development environment running
1. Clone or download this repository, repo consist of 3 services, auth-gateway, portal, web-rtc; below steps are required for each of the services
2. Install all the dependencies.
```
"npm install"
```    
3. Start the server
```
"npm start"
```

4. Open in browser
```
 "localhost:<ENV_PORT>"
```

## Built With

* [Express](https://expressjs.com/) - Express Framework

## Development Standards

This is a first, lightweight set of standards. It will grow over time. When in doubt, follow the
pattern the surrounding code in that service already uses.

### Branches and pull requests

- Cut every branch from `development_master` and open the PR back into `development_master`.
- Name branches `<type>/<ticket>-<short-description>`, e.g. `fix/ayu-46-manual-ai-wrappers`,
  `feature/cron-manual-trigger`.
- Keep a PR to one logical change, in one service where possible. Describe what changed and why,
  and call out any migration or new environment variable.
- Do not merge your own PR without a review.

### Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). The husky `commit-msg`
hook runs commitlint (`.commitlintrc.json`) and rejects anything else.

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

- Change the schema only through a Sequelize migration (`npm run migrate`). Never use
  `sync({ alter })` or hand-run `ALTER` statements.
- A migration must have a working `down`.
- Use Sequelize queries with bound parameters. Never build SQL by concatenating strings.

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

A new variable must be added in two places: the service's `example.env` and that service's `.env`
list in this README. Never commit `.env`, keys or certificates.

### Tests

Add tests to any service that already has a test harness: `cron-microservice` (`npm test`,
`node --test`) and `configuration-microservice` (`npm test`, `npm run lint`). Run them before
opening the PR.

## Below .env service wise.

## portal .env (Create .env in the portal folder and use below environment keys)

```
NODE_ENV=xxxx
DOMAIN=xxxx

OPENMRS_USERNAME=xxxx
OPENMRS_PASS=xxxx

MYSQL_HOST=xxxx
MYSQL_PORT=xxxx
MYSQL_DIALECT=xxxx
MYSQL_USERNAME=xxxx
MYSQL_PASS=xxxx
MYSQL_DB=xxxx
MYSQL_OPENMRS_DB=xxxx

APIKEY_2FACTOR=xxxx
OPEN_AI_KEY=xxxx
OPEN_AI_BASE_URL=xxxx

MAIL_USERNAME=xxxx
MAIL_PASSWORD=xxxx
OAUTH_CLIENT_ID=xxxx
OAUTH_CLIENT_SECRET=xxxx
OAUTH_CLIENT_REFRESH_TOKEN=xxxx

VAPID_PUBLIC_KEY=xxxx
VAPID_PRIVATE_KEY=xxxx
VAPID_MAILTO=xxxx

FIREBASE_DB_URL=xxxx
FIREBASE_SERVICE_ACCOUNT_KEY=xxxx

AWS_ACCESS_KEY_ID=xxxx
AWS_SECRET_ACCESS_KEY=xxxx
AWS_REGION=xxxx
AWS_BUCKET_NAME=xxxx
AWS_URL=xxxx

ALLOWED_ORIGINS=[xxxx, xxxx, xxxx]

SSL_PRIVATE_KEY=xxxx
SSL_CERT=xxxx

```

## auth-gateway .env (Create .env in the auth-gateway folder and use below environment keys)

```
NODE_ENV=production
PORT=xxxx
SSL_KEY_PATH=xxxx
SSL_CERT_PATH=xxxx
DOMAIN=xxxx
ALLOWED_ORIGINS=[xxxx, xxxx, xxxx]
```

## web-rtc .env (Create .env in the web-rtc folder and use below environment keys)


```
PORT=xxxx
SECRET=xxxx
API_KEY=xxxx
SSL=xxxx  # make this true and pass cert and key path below to enable ssl and making site https
SSL_CERT_PATH=xxxx
SSL_KEY_PATH=xxxx
LIVEHOST=xxxx
TCP=xxxx
UDP=xxxx
```
