# Queue Management System (QMS)

Live patient queue, priority scoring, doctor assignment and wait-time estimation for
Intelehealth's telemedicine platform.

Implements the **QMS Low-Level Design** (§02–§14) and the **Priority Engine Algorithm
Spec** (§01–§11). Section references throughout the code point back at those documents,
so any behaviour here can be traced to the paragraph that asked for it.

---

## Where this differs from the documents, and why

Four differences. None of them change what the system does; three follow from the
storage decision, and one is a defect in the spec's arithmetic.

### 1. MySQL, not Redis

The LLD builds the live queue on Redis sorted sets. This service is MySQL-only, per the
architecture decision taken for `queue-microservice`. Every Redis operation in the docs
has an exact SQL equivalent, and all of the scoring, aging, SLA, ETA and idempotency
logic is preserved unchanged:

| LLD §03 (Redis)              | Here (MySQL)                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| `queue:speciality:{x}` ZSET  | `ORDER BY priority_score DESC, queued_at ASC, id ASC`               |
| `queue:critical` ZSET        | A separate, exclusive read path — still a lane, never a weight       |
| `ZREVRANK`                   | `COUNT(*)` of entries sorting ahead, `+ 1`                           |
| `ZINCRBY` (aging)            | `UPDATE … SET priority_score = base_score + <W(m)>`                  |
| `ZREM` returning 1 or 0      | Conditional `UPDATE`; `affectedRows` is the race verdict             |
| `case:{id}` HASH             | The row itself                                                        |
| `doctors:active:{x}` SET     | `doctor_queue_status WHERE speciality = ? AND status = 'online'`     |

Two things get *better* under this mapping:

- **No resurrection window.** Priority Engine §03 warns that `ZINCRBY` against a member
  removed by a concurrent claim silently re-creates it. An `UPDATE` whose `WHERE` clause
  no longer matches simply affects zero rows, so the bug cannot occur.
- **`SELECT … FOR UPDATE SKIP LOCKED`** (MySQL 8.0.1+) means two doctors asking for the
  next patient at the same instant are handed two different cases, rather than contending
  for one. The conditional `UPDATE` remains the correctness guarantee; the lock is the
  efficiency win.

### 2. No socket server

LLD §10 specifies Socket.io events. This service has no socket server. §08's tiering,
500 ms debounce, 5-minute EWT threshold, 30-second frequency cap and
escalation-bypass are all implemented exactly as written — what they gate is an
outbound push (`NOTIFICATION_WEBHOOK_URL`, e.g. portal's FCM relay) plus the silent
write that `GET /api/queue/:id/status` then serves. Tier 4 ("pull on demand") *is* the
poll endpoint, and it doubles as the resync path.

This also sidesteps the blocker the Web LLD §02 flags: the doctor webapp is on
`socket.io-client@^2.5.0`, which cannot connect to a v4 server without `allowEIO3`.

### 3. The ε tie-break term is not folded into the score

Priority Engine §01 adds `ε = queued_at_epoch_ms / 1e6` as a FIFO tie-break and works
through the float headroom needed to carry it inside one sorted-set score. Taken
literally that has two problems:

- At current epoch times ε ≈ **1.79 × 10⁶**, which dwarfs the 3–4 digit weighted terms
  instead of breaking ties between them — it would dominate the ranking outright.
- Because higher score = more urgent, a term that *grows* with arrival time orders the
  queue **LIFO** — the opposite of the FIFO tie-break it is meant to provide.

On MySQL none of that packing is needed: ordering is
`priority_score DESC, queued_at ASC, id ASC`, which is an exact FIFO tie-break with no
precision budget to manage. §01's intent is preserved; its numeric encoding is not.

### 4. The wait term is weighted (§01), not raw (§08)

§01 defines `P = w_E·E + w_C·C + w_W·W + w_S·S + V` and §07 enforces `Σw = 1.0`. The
worked traces in §08 add `W` un-weighted (a 45-minute follow-up is shown as
`0 + 15 + 255 + 10 = 280`), which contradicts both. §01 is the normative statement and is
what runs. `weights.wait` is config, so a different intended calibration is a config
change, not a code change.

Two smaller arithmetic slips in the docs, noted but not "fixed" in code: §08's third
trace cites a "same-instant new HIGH case (490)" that does not reproduce from any
reading of the formula (it is 300 weighted, 800 raw), and the §06 doctor-assignment
example prints 87.6 / 74.4 / 58.2 where its own weights give 86.8 / 72.4 / 67.6. The
normative weights are implemented; the example totals are not reproduced.

---

## The one behavioural question the docs answer differently

**Can an SLA-escalated case overtake the CRITICAL fast lane?**

- LLD §05.4: the critical lane "drains first and only checks the speciality queue if it's
  empty."
- Priority Engine §09: a FOLLOW_UP must be dequeued within its 45-minute cap
  "regardless of N" critical arrivals per hour.

Both cannot hold if CRITICAL always wins — a high enough critical arrival rate starves
everything behind it indefinitely. They reconcile on the wording: §05.4's guarantee is
that no *score arithmetic* can delay an emergency, and that still holds because CRITICAL
is a separate read path rather than a weight. An SLA force-promote is not score
arithmetic; it is the independent safety net of §05.3, and LLD §04 defines ESCALATED as
"sits at the front regardless of score".

So this service drains **three lanes in order**: `ESCALATED` → `CRITICAL` → `NORMAL`.
Within the escalated lane the order is by `escalated_at ASC` — first to breach, first
served. (Ordering it by score would be LIFO, because §04's force-promote sets each newly
escalated case to the current top + 1.)

Set `ESCALATION_OUTRANKS_CRITICAL=false` for the strict §05.4 reading. **This is a
clinical call, not an engineering one** — it belongs with the sign-off Priority Engine
§00 asks for on every other number in §02 and §04.

### What the starvation regression can and cannot assert

Building §09's test surfaced a limit worth recording. "Dequeued within its SLA cap
regardless of N" is not achievable, for two concrete reasons:

- Nothing preempts a consultation in progress, so a case at the very front still waits
  out the current call. The tightest achievable service bound is **cap + one consult
  cycle**.
- CRITICAL cases have their own 5-minute cap. Once arrivals outrun service capacity,
  criticals breach and escalate too — earlier than the follow-up and ahead of it. At that
  point the queue is growing without bound and the answer is capacity, not ordering.

What *does* hold regardless of N, and is asserted at every arrival rate and every
capacity level in `tests/starvation.test.js`, is that the follow-up is **force-promoted
out of score competition within one tick of its cap**. The service bound is asserted
separately, under the capacity condition that makes it meaningful.

---

## Layout

```
server.js                         boot: DB → priority config (fail closed) → jobs → listen
src/
  config/
    env.js                        all tunables, with documented defaults
    priority.default.js           §02/§07 defaults — pending clinical sign-off (§00)
    database.js                   sequelize-cli config
  models/                         queue_entries, doctor_queue_status,
                                  doctor_service_stats, priority_config
  migrations/                     the four tables, defaults seeded
  services/
    priority.service.js           §01–§04: P(case,t), W(m), V(vitals), floors, SLA caps
    priorityConfig.service.js     §07: load, validate (Σw = 1.0), admin update
    queueLane.service.js          the sorted-set equivalent: lanes, rank, peek, SKIP LOCKED
    queue.service.js              §09: submit / claim / release / complete / requeue
    doctorAssignment.service.js   §06: eligibility filter, then weighted scoring
    doctorStatus.service.js       §09.3 live status + the §06 on-shift check
    eta.service.js                §07: Lq/(c·μ) + overhead, Model A/B per speciality
    notification.service.js       §08: tiering, 500 ms debounce, EWT threshold
    analytics.service.js          §09.4: live ops view + always-on accuracy report
  jobs/
    aging.job.js                  §03, idempotent by delta against the closed form
    slaPromote.job.js             §04, escalate-once, promote to current top + 1
    sweep.job.js                  heartbeat flagging, stuck calls, crashed clients
    accuracyAlert.job.js          §13.4, pages on-call when the estimate drifts
  middleware/                     auth (JWT or x-qms-secret), §13.1 authz, §13.2 limits
  docs/openapi.js                 §13.6: one shared contract for backend/Android/Web
tests/                            §09's validation methodology, 40 assertions
```

## Running it

```bash
cp .env.example .env          # then set QMS_SERVICE_SECRET and DB credentials
cp <shared>/public_key.pem .pem/public_key.pem
npm install
npm run migrate               # creates the four tables and seeds priority_config
npm start                     # or: npm run dev
npm test                      # 40 assertions, no database required
```

> **Before the first migration — there is a prototype `queue_entries` table in the way.**
> `DB_NAME` defaults to `mindmap_server`, portal's database, which already contains a
> `queue_entries` table from the July 2026 QMS prototype: a different schema
> (`patientName`, `specialty`, `priority INT`, and the old
> `WAITING/ASSIGNED/IN_CALL/COMPLETED/CANCELLED/STALE` lifecycle) holding a couple of test
> rows. The migration will fail against it. Drop it, or point `DB_NAME` at a database of
> QMS's own — that is a call for whoever owns that data, not something the migration
> should do silently.
>
> QMS keeps its migration history in `SequelizeMetaQms`, separate from portal's
> `SequelizeMeta`, so the two services can share a database without either one seeing the
> other's migrations.

`GET /health` is public. `GET /api-docs` serves the OpenAPI contract; `GET /api-docs.json`
is the raw document — generate the Android and Angular clients from it rather than
hand-keeping a third and fourth copy of the shapes (§13.6).

## API

Full request/response shapes are in the OpenAPI document. In brief:

| Method | Path | § |
| ------ | ---- | - |
| `GET` | `/api/queue/list` — all queue items, or one speciality's | — |
| `GET` | `/api/queue/specialities` — speciality-wise counts | — |
| `POST` | `/api/queue/submit` — idempotent on `visitUuid` | §09.1 |
| `GET` | `/api/queue/:id/status` — poll / resync | §09.1 |
| `DELETE` | `/api/queue/:id` — HW withdraws | §09.1 |
| `POST` | `/api/queue/:id/heartbeat` — flags, never auto-cancels | §09.1 |
| `GET` | `/api/queue/doctor/:uuid/list` — panel, critical lane merged | §09.2 |
| `POST` | `/api/queue/doctor/:uuid/next` — SKIP LOCKED "next patient" | §09.2 |
| `POST` | `/api/queue/:id/claim` — 409 `CASE_ALREADY_CLAIMED` on the loser | §09.2 |
| `POST` | `/api/queue/:id/release` — back at its prior score, unpenalised | §09.2 |
| `POST` | `/api/queue/:id/complete` — frees the doctor, updates μ | §09.2 |
| `POST` | `/api/queue/:id/connecting`, `/connected`, `/requeue` — call lifecycle | §04 |
| `PATCH` | `/api/doctor/:uuid/status` — the accuracy-critical one | §09.3 |
| `GET` | `/api/queue/analytics/live`, `/analytics/accuracy` | §09.4 |
| `GET`/`PUT` | `/api/queue/config` — priority tuning (admin) | §07 |

**This service never calls web-rtc.** After a claim the client calls LiveKit's `getToken`
itself, exactly as it does today (§01, §11).

### Listing queue items

The two list endpoints are additions to the LLD, which only specified the per-doctor
panel (§09.2). They exist for admin dashboards, health-worker "what's pending" views and
portal-side integration.

```bash
# everything currently waiting, in the order it will actually be served
GET /api/queue/list

# one speciality
GET /api/queue/list?speciality=General%20Physician

# widen beyond the queue proper
GET /api/queue/list?status=ACTIVE      # + ASSIGNED / CONNECTING / CONNECTED
GET /api/queue/list?status=ALL
GET /api/queue/list?status=COMPLETED,CANCELLED

# other filters, all combinable
?emergencyLevel=CRITICAL  ?caseType=REFERRAL  ?escalated=true  ?flagged=true
?hwUserUuid=…  ?doctorUuid=…  ?visitUuid=…  ?locationUuid=…
?queuedFrom=2026-08-12T00:00:00Z  ?queuedTo=…
?sort=priority|queuedAt|-queuedAt|waitedLongest|recent
?limit=50&offset=0   ?includeEta=false   ?includeScore=true

# counts per speciality, optionally with a preview of the top cases
GET /api/queue/specialities
GET /api/queue/specialities?withItems=true&itemsPerSpeciality=5
```

Three things worth knowing about the list:

- **Order is the real serving order** — ESCALATED, then CRITICAL, then by score, then
  FIFO. The top of the list is the next patient, not merely the oldest one.
- **Positions are relative to the full lane, not the page.** They come from one walk of
  each lane the page touches, so a 50-item page costs a handful of queries rather than 50
  counts, and page 3 does not renumber anyone from 1.
- **`priorityScore` is withheld** unless `includeScore=true` *and* the caller is an admin
  or internal service. Priority Engine §01: P is a sort key, never a display value —
  clients should render `position` and `etaMinutes`.

**Access.** Admins and `x-qms-secret` callers see everything. Any other login is scoped to
cases it submitted or is assigned to, so an ordinary token cannot read the whole patient
list (§13.1). The response echoes `appliedFilters.scopedToCaller` so a client can tell
which it got.

## Integration from the existing services

QMS is a separate deployment; if it isn't wanted, it simply isn't deployed. But any QMS
call added to portal or web-rtc **must** be env-flag gated (`QMS_ENABLED`, default off)
and fail-safe — wrap it in `try/catch` so a QMS outage can never break a WebRTC call or a
visit upload. Callers authenticate with the `x-qms-secret` header.

Natural hook points: call start → `POST /:id/connected`; call end →
`POST /:id/complete`; a crashed client is caught by the sweep job regardless.

## Security and operations

- **§13.1** — a doctor can only change their own status; overriding another user, or
  cancelling a case on a patient's behalf, requires an admin role.
- **§13.2** — per-user rate limits on `/submit` and `/heartbeat`. In-process, so it
  protects a single node; move to a shared store if QMS is ever run multi-instance.
- **§13.3** — `queue_entries` holds chief complaint and vitals. **Turn on encryption at
  rest for the MySQL data directory**, the same baseline the rest of the patient data
  already needs. Logs and notification payloads carry identifiers only, never clinical
  content.
- **§13.4** — `ACCURACY_ALERT_*` pages on-call when MAE stays above threshold. Ops
  alerting only; the payload is numbers, never patient data.
- **§12** — `/analytics/accuracy` ships in the same release as the queue, not as a
  follow-up. It is what tells you whether §07's calibration still holds.

## Open decisions

Carried forward from the documents. All have a working default; none are settled.

| Decision | Default here | Status |
| -------- | ------------ | ------ |
| Every point value in §02/§04 — 1000 for CRITICAL, the 40/30/20/10 weights, vitals thresholds, SLA minute caps | As documented | **Needs clinical sign-off** (Priority Engine §00) |
| Vitals total that auto-escalates to CRITICAL | 300 (SpO₂ < 90 alone) | Named but not numbered by the spec — confirm clinically |
| Escalation outranks the critical lane | Yes | Clinical call — see above |
| Queue granularity | One line per speciality, all facilities | §13.5 — product call |
| Critical lane scope | Per speciality | §03 says all specialities; that offers a cardiology emergency to any free doctor |
| ETA model per speciality | B (doctor-level) | §07 — re-tune from `/analytics/accuracy` |
| Per-speciality overhead constant | 19 min | §07 — calibration predates priority reordering |
| On-shift filter | Off by default | §06 says reuse portal's day-off data; enabling it reads a table portal owns |
| Doctor rating source | Config default 4.0 | §06 weights it at 10%, but no rating data exists in the repo |
| Relationship to the scheduled-appointment flow | Two separate flows, permanently | §14 — product roadmap call |
