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

## VoiceDoc transcription (portal)

The portal records doctor/health-worker calls in chunks, forwards them to VoiceDoc (Jatayu) and stores the transcript and structured summary in `call_transcripts` (migration `20261030120000-create-call-transcripts`), with one row per chunk in `call_transcript_chunks` (migration `20261102120000-create-call-transcript-chunks`). Every route needs the user JWT.

| route | access | response |
| --- | --- | --- |
| `POST /api/voicedoc/sessions` | any user, flag-gated | body `{ visitUuid, patientUuid, doctorUuid, chwUuid?, roomId?, language?, source? }`. `source` is `webapp` (default) or `mobile`, anything else is `400`. `201 { success, data: { sessionId, chunkId, name, source } }`. |
| `POST /api/voicedoc/sessions/:id/chunks` | any user, flag-gated | multipart `file` (WAV, max 2 MB) + `chunkNumber`, plus optional audio levels `localRms`, `localPeak`, `remoteRms`, `remotePeak` (floats, clamped to 0..1) and `localSources`, `remoteSources` (integers, 0 or more); a non-numeric level is stored as `null`. `202`; `404` unknown session; `409` session not `recording`; `429` too many queued chunks. |
| `POST /api/voicedoc/sessions/:id/end` | any user | `202 finalizing` (`200` if already ended). Not gated, so a call in progress still finalizes after the flag is turned off. |
| `GET /api/voicedoc/visit/:visitUuid` | any user | `200` the visit's sessions, newest first. Not gated. |
| `GET /api/voicedoc/transcripts?page=1&limit=10&source=webapp\|mobile` | admin | `200 { success, data: { items, total, page, limit } }`, sorted `started_at DESC, id DESC`. `limit` defaults to 10 and is capped at 50; a bad `page`, `limit` or `source` is `400`. |
| `GET /api/voicedoc/transcripts/:id` | admin | `200 { success, data }` with the item fields plus `transcript`, `summary`, `rawResponse`, `combinedAudioResponse` and `chunks`; `404` if missing. |

List items: `id, visitUuid, patientUuid, patientName, patientIdentifier, doctorUuid, doctorName, chwUuid, chwName, source, status, language, recordingName, chunksReceived, chunksUploaded, chunksFailed, startedAt, endedAt, durationSec, transcriptPreview` (first 160 characters, or `null`)`, hasSummary, error`. The list query does not load the full transcript or summary.

Detail extras: `rawResponse` is the unmodified VoiceDoc end-stream body, `combinedAudioResponse` the upload-combined-audio body (both `null` until set). `chunks` is `[{ chunkNumber, status, attempts, bytes, durationMs, localRms, localPeak, remoteRms, remotePeak, localSources, remoteSources, response, error, uploadedAt }]`, sorted by `chunkNumber`. `GET /api/voicedoc/visit/:visitUuid` leaves out the two raw response columns.

### Stored responses and chunks

`call_transcripts.raw_response` (JSON) holds the full end-stream body, also when the session ends as `empty`, or as `error` when VoiceDoc answered with a body. `call_transcripts.combined_audio_response` (JSON) holds the upload-combined-audio body, or `{ error, status, body? }` when that call failed. A body that is not JSON is stored as `{ "raw": "<text>" }`.

`call_transcript_chunks` has one row per `(call_transcript_id, chunk_number)` (unique, FK to `call_transcripts.id` with `ON DELETE CASCADE`): `bytes`, `duration_ms` (from the WAV header, else `(bytes - 44) / 32` for 16 kHz mono 16-bit), the six level fields as `local_rms`, `local_peak`, `remote_rms`, `remote_peak`, `local_sources`, `remote_sources`, plus `status`, `attempts`, `response` (the full upload-and-transcribe body), `error` and `uploaded_at`. Status moves through:

- `queued` when the chunk is accepted (a re-sent chunk number resets its row),
- `uploaded` with `attempts`, `response` and `uploaded_at` once VoiceDoc accepts it,
- `failed` with `error`, `attempts` and any error body after the last retry,
- `skipped` when the chunk is refused because the session already ended (`409`), the flag is off (`403`) or the queue is full (`429`), or when it was still `queued` at finalize (lost from the in-memory queue, for example after a restart). A refused chunk never overwrites an existing row.

Chunk-row writes are best-effort: a failed write is logged and never stops the upload. Real VoiceDoc answers (checked 2026-11-02): upload-and-transcribe returns `{ "status": "ok", "chunk_number": 1, "blob": "" }`; end-stream returns `{ "message": "End-stream processing successful", "transcript": "...", "summary": { "<field>": [ ... ] } }`. The mock client returns the same shapes.

### Feature flags

Session creation and chunk upload check the configuration service's published config (`GET ${CONFIG_SERVICE_URL}/config/getPublishedConfig`, no auth, 5 s timeout, cached 60 s):

- `ai_llm_voice_transcript_section` (boolean, also accepted as `1`/`0`/`"1"`/`"0"`/`"true"`)
- `ai_llm_voice_transcript` (object, also accepted as a JSON string) with `record_transcribe_webapp`, `record_transcribe_mobile`, `feed_ai_ddx`, `autofill_doctor_notes`

Recording is allowed for a source only when the section flag and `record_transcribe_<source>` are both on. Otherwise the route answers `403 { success: false, message: "Voice transcription is disabled", code: "VOICEDOC_DISABLED" }`. Chunks are re-checked against the session's stored `source`, so turning the flag off stops uploads mid-call. A failed refresh keeps the last good config; if the config was never fetched (unset or unreachable `CONFIG_SERVICE_URL`), recording is disabled. After a failed fetch the portal retries after 15 s.

### Admin access

The transcript list and detail require the OpenMRS role `Organizational: System Administrator` (compared case-insensitively on name or display). The portal looks up `GET /openmrs/ws/rest/v1/user/{userId}?v=custom:(uuid,roles:(name,display))` with its `OPENMRS_USERNAME`/`OPENMRS_PASS` service account, caching the answer for 5 minutes per user. A non-admin or a failed lookup gets `403 { success: false, message: "Admin access required" }`.

Names are filled in best-effort from OpenMRS and cached for 10 minutes per uuid, so a lookup failure leaves the name `null` without failing the request. `patientUuid` resolves through `/patient` (person display plus the preferred identifier). The doctor webapp sends OpenMRS **provider** uuids as `doctorUuid` and `chwUuid`, so those resolve through `/provider`, then `/user` if no provider matches.

### Env

Required:

```
VOICEDOC_EMAIL=xxxx
VOICEDOC_PASSWORD=xxxx
```

Optional overrides (defaults shown):

```
CONFIG_SERVICE_URL=https://<DOMAIN>:4004/api   # configuration-microservice base, including /api; derived from DOMAIN
VOICEDOC_MOCK=false                            # true uses an in-process fake VoiceDoc
VOICEDOC_AUTH_URL=https://intelehealth-auth-tyohwkctkq-el.a.run.app
VOICEDOC_CORE_URL=https://core-tyohwkctkq-el.a.run.app
VOICEDOC_HELPER_URL=https://intelehealth-helper-service-tyohwkctkq-el.a.run.app
VOICEDOC_FORCE_LOGIN=true
VOICEDOC_ENCRYPT_AUDIO=true
VOICEDOC_LANGUAGE=auto
VOICEDOC_TIMEZONE=Asia/Kolkata
VOICEDOC_MAX_PENDING_CHUNKS=90
VOICEDOC_END_STREAM_TIMEOUT_MS=600000
```

Tests: `npm test` (`node --test test/*.test.js`), no network or database needed.
