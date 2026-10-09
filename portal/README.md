# Doctor-WebApp-Mindmap-Service

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites
Node.js
   ```
   https://nodejs.org/en/
   ```
   
    
### Installing
A step by step series of examples that tell you how to get a development environment running
1. Clone or download this repository, repo consist of 3 services, auth-gateway, mindmap-service(root folder), livekit-token-microservice; below steps are required for each of the services
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

## Commeting Message (Examples)
1.Commit message with description and change in body
```
fix: allow provided config object to extend other configs
```
2.Commit message with scope
```
feat(lang): add language data
```
3.Commit message with optional ! to draw attention to breaking change
```
revert!: drop Node 12 from testing matrix
```

## Below .env service wise.

## mindmap-service .env (Create .env in the root folder and use below environment keys)

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

APIKEY_2FACTOR=xxxx
OPEN_AI_KEY=xxxx

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

```

## auth-gateway .env (Create .env in the auth-gateway folder and use below environment keys)

```
NODE_ENV=production
PORT=xxxx
SSL_KEY_PATH=xxxx
SSL_CERT_PATH=xxxx
DOMAIN=xxxx
```

## livekit-token-microservice .env (Create .env in the web-rtc folder and use below environment keys)


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

## AI diagnosis proxy (portal)

The portal forwards `/api/ddx` and `/api/ttxv1` to ai-middleware. Required keys:

```
AI_MIDDLEWARE_BASE_URL=xxxx
AI_MIDDLEWARE_API_KEY=xxxx   # no surrounding quotes
```

Both are mandatory. A missing key fails the request with a "not configured (missing API key)" message instead of sending an unauthenticated request, because ai-middleware answers those with a 401 that reads like a rejected key.

Do not wrap the key in quotes. Docker Compose `env_file` keeps surrounding quotes as part of the value while `dotenv` strips them, so a quoted key works when the portal runs directly and fails from a container. The proxy strips them defensively, but the `.env` should not have them.

Upstream 400/422 responses are validation failures, most often a visit with no recorded weight. ai-middleware requires `Age`, `Weight (kg)` and `Gender` in the case history for both `/ddx` and `/ttxv1`, and weight is only present when the visit has a Vitals encounter. These are returned with the upstream `msg` as `message` and the raw pydantic `detail` preserved.

Env changes need `docker compose up -d --force-recreate portal`; `docker restart` reuses the old environment.

## Precomputed DDx (portal)

The cron-microservice computes DDx ahead of time into `ai_ddx_results`, fed by `visit_queue`. The portal only reads and requeues:

| route | response |
| --- | --- |
| `GET /api/ai-ddx/:visitUuid` | `200` stored response; `202` `pending` while the visit has a `waiting`/`processing` queue row; `404` `failed` or `not_found`. Every non-200 body carries a user-facing `message` the doctor webapp displays as-is. |
| `POST /api/ai-ddx/:visitUuid/retry` | `202` `pending`. Resets the queue row to `waiting`, `attempts = 0`, `priority = high` (creating it from OpenMRS if the visit was never queued), so the worker picks it up on its next tick ahead of normal visits. A row already `processing` is left alone. `404` if the visit does not exist. |

A `failed` queue row is terminal: the worker never retries it and the sync job never re-adds it, so `retry` is the only way back. The doctor webapp calls `retry` itself, once per page load, when the GET answers `failed` or `not_found`; only if that attempt also fails does the doctor see the error and the Try again button. A visit that fails while the page is already waiting on it is not retried again, since the worker has just spent its attempts on it. The pending check looks at the queue before `ai_ddx_results`, so a visit whose earlier attempt failed but is queued again reports `pending`, not `failed`.

### Realtime updates instead of polling

The webapp does not poll while a visit is `pending`, because every API call shows its global loader. It waits on the existing socket.io connection instead:

1. The page emits `ai_ddx_watch` `{ visitUuid }`. The portal joins that socket to room `ai_ddx:<visitUuid>`, then checks the status, and if the visit is already finished it emits `ai_ddx_status` straight back (joining first closes the race where the worker finishes between the page's GET and its watch).
2. When the worker marks a visit `done`, or `failed` on its last attempt, cron-microservice calls `POST /api/ai-ddx/notify` `{ visitUuid, status }` with header `X-AI-DDX-Notify-Token`. The portal emits `ai_ddx_status` to the room.
3. The page makes one GET for the result and emits `ai_ddx_unwatch`.

`/notify` is server-to-server, so it skips user JWT auth and checks `AI_DDX_NOTIFY_TOKEN` instead. It fails closed: with the token unset it returns `404`. cron-microservice needs the same token plus `AI_DDX_NOTIFY_URL`; if either is unset it skips notifying, and an open page waits up to 5 minutes before showing the pending message with Try again.

Rooms live in the portal process's memory (default socket.io adapter), so this assumes one portal instance, the same assumption the call and chat sockets already make.
