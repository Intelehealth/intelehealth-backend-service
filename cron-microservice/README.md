# Cron microservice

Independent scheduler and health server for backend cron jobs. It listens on port `3010` by default.

The daily report reads patient and visit metrics from OpenMRS, call metrics from the portal database, recording counts from S3, and persists the generated report in the portal database.

```bash
cp example.env .env
npm install
npm run migrate
npm start
```

Add jobs to `src/crons/jobs` and register them in `src/crons/index.js`. Every job owns its schedule and enable flag.

```bash
npm run cron:daily-report:preview
npm run cron:daily-report
npm run cron:daily-report -- --force
npm test
```

Debug mode sends to `SLACK_DAILY_REPORT_DEBUG_WEBHOOK_URL`. Without a debug webhook, the exact Slack payload is printed without sending a request.

## Recording counts in S3

WebRTC recordings are written by the `web-rtc` service through LiveKit egress
(`src/services/webrtc.service.ts`), which sets the object key to:

```
<BRANDNAME>/<DOMAIN>/<location>/recording-DD-MM-YYYY_HH:mm:ss.mp4
```

So the bucket is partitioned by **location**, not by date, and the day a
recording belongs to lives in the file name. `location` falls back to `Other`
when the caller sends none. `WEBRTC_RECORDINGS_S3_PREFIX` is the
`<BRANDNAME>/<DOMAIN>/` part, and the location folders are its direct children.

Counting therefore uses the `key-timestamp` strategy rather than `LastModified`:

- `LastModified` is the upload-completion time. A call that starts at 23:50 and
  ends after midnight lands on the wrong day, and any later copy of the object
  rewrites the value. The key timestamp is the recording start time and never
  moves.
- The bucket has no date partition, so a plain prefix scan would grow with the
  lifetime of the bucket. The job lists the location folders once with
  `Delimiter=/`, then lists `<location>/recording-<DD-MM-YYYY>_` per location —
  a handful of day-scoped listings instead of a full scan.
- LiveKit writes a small `EG_<egressId>.json` manifest next to every `.mp4`,
  so counting every object under the prefix would double the number. Matching
  on the `recording-` file prefix excludes the manifests. The same filter drops
  the pre-August-2025 keys, which used a flat `<uuid>-<ISO timestamp>.mp4` name
  with no location folder.
- Each metric also returns a per-location `breakdown`, persisted in
  `cron_reports.metrics`.

Timestamps in keys carry no timezone, so they are read in `CRON_TIMEZONE`
(override per metric with `keyTimezone`). This is correct as long as the
`web-rtc` host runs in the same timezone as this service.

Per-metric S3 options in `DAILY_REPORT_S3_METRICS`:

| Option | Default | Purpose |
| --- | --- | --- |
| `strategy` | `last-modified` | `key-timestamp` for the recording naming convention above |
| `filePrefix` | `recording-` | File name prefix before the timestamp |
| `keyDateFormat` | `DD-MM-YYYY` | Date part of the file name |
| `keyTimeFormat` | `HH:mm:ss` | Time part of the file name |
| `keyTimezone` | `CRON_TIMEZONE` | Timezone the key timestamps were written in |

Kaleyra recordings stay on `last-modified` until their key layout is confirmed.

Verify a bucket read-only — it lists the location folders, samples keys with the
parsed timestamp beside the S3 `LastModified`, and prints the per-day counts:

```bash
npm run s3:inspect-recordings
npm run s3:inspect-recordings -- --bucket=my-bucket --prefix=IDA/dev.intelehealth.org/ --days=14
```

## Recording metrics: started vs stored

The report carries three recording numbers, and they intentionally disagree:

| Metric | Source | Counts |
| --- | --- | --- |
| WebRTC recordings started today | `call_recordings` | Egress jobs the `web-rtc` service kicked off |
| WebRTC recordings completed today | `call_recordings` | Of those, the ones that reached `stopRecording` |
| WebRTC recordings today | S3 | `.mp4` files that actually exist in the bucket |
| Average recording length | `call_recordings` | Mean `end_time - start_time`, in seconds |
| Recordings under 30 seconds | `call_recordings` | Likely-abandoned calls |

A `call_recordings` row is written when recording **starts**
(`web-rtc/src/services/webrtc.service.ts`), so an egress that never produces a
file still leaves a row. On staging, one location held 194 rows against 32
stored objects. Started-minus-stored is therefore a useful failure signal, not
an inconsistency to reconcile away.

`start_time` and `end_time` are stored in UTC while the MySQL session runs in
the deployment's local zone, so these two metrics bind `:startUtc` / `:endUtc`
from the report period rather than using `CURDATE()` like the older metrics. A
naive comparison misfiles any recording started between midnight and the UTC
offset — verified against a real row, `2026-07-08 18:32:07` UTC, which is
`09-07-2026 00:02:07` IST.

## Reporting window

No metric reads the clock itself — every query is bound to the report period, so
a report can be re-run for an earlier date and the numbers stay inside one
window. Two placeholder pairs exist because the two databases disagree about
timezones:

| Placeholder | Bound in | Used by |
| --- | --- | --- |
| `:startUtc` / `:endUtc` | UTC | Portal tables (`call_data`, `call_recordings`) — Sequelize writes UTC |
| `:startLocal` / `:endLocal` | `CRON_TIMEZONE` | OpenMRS tables — written in the server's local zone |

Storage zones were confirmed against the data rather than assumed: portal
timestamps cluster at 07:00–13:00 in-column against IST clinic hours, OpenMRS
timestamps at 12:00–18:00. Using the wrong pair shifts a day boundary by the UTC
offset and misfiles early-morning and late-night activity.

S3 recording metrics carry a `detail` line listing the busiest locations, which
the Slack builder renders as a context block under the section.

## Google Analytics metrics

GA4 is a *secondary* source. It answers one thing no server-side query can — a
button press that never reaches the backend — and it is wrong in a specific,
known direction: `googletagmanager.com` is on every ad-blocker list, so a
doctor running one is invisible. Treat GA counts as a floor, not a total. GA4
reporting data is also not final intraday and can be revised after the 23:55
run. Anything that must be exact belongs in a database metric.

The events are emitted by `doctor-webapp` through `AnalyticsService.logEvent`:

| Event | Emitted from | Metric |
| --- | --- | --- |
| `start_call` | `visit-summary` / `visit-summary-v2` | Start Call button presses |
| `whatsapp_call_started` | `startWhatsAppCall()` | WhatsApp calls started |
| `whatsapp_call_ended` | `endWhatsAppCall()`, carries `callDuration` | — |
| `kaleyra_call_initiated` | `startKaleyraCall()` success | Kaleyra calls initiated |
| `kaleyra_call_failed` | `startKaleyraCall()` error | — |

All configured events are fetched in **one** `runReport` grouped by `eventName`,
not one call per metric.

```
GA_PROPERTY_ID=123456789
GA_PROPERTY_TIMEZONE=Asia/Kolkata
GA_HOSTNAME=as.intelehealth.org
GA_SERVICE_ACCOUNT_JSON={"client_email":"...","private_key":"..."}
```

`GA_PROPERTY_ID` is the **numeric** property ID from GA Admin → Property
Settings, not the `G-XXXXXXXXXX` measurement ID the browser uses.

`GA_HOSTNAME` is not optional in practice. Every NAS deployment ships the same
`GAMEASUREMENTID`, so production, `nasstaging`, `nasstagingnew` and `ttxai` all
report into one property. Without a host filter the report returns the sum of
every environment; the job warns when it is unset.

`GA_SERVICE_ACCOUNT_JSON` may be replaced by `GOOGLE_APPLICATION_CREDENTIALS`
pointing at a key file. The service account needs only **Viewer** on the GA4
property. A key file path is fine locally, but a deployed container should
receive the JSON through the secret store rather than a path that only exists on
one machine.

The property is shared by more than the NAS sites. Events observed over 90 days:

| hostName | events |
| --- | --- |
| `demoai.intelehealth.org` | 1,939 |
| `nasstaging.intelehealth.org` | 641 |
| `localhost` | 237 |
| `35.154.153.252` | 7 |

`localhost` is developer machines. Without `GA_HOSTNAME` those land in the
report as real usage.

GA4 resolves a `dateRange` against the *property's* timezone, not ours, so
`GA_PROPERTY_TIMEZONE` is asserted against `CRON_TIMEZONE` and the report fails
loudly on a mismatch rather than silently reporting a shifted day. When the
property or credentials are unset the GA metrics are **skipped with a warning**
rather than reported as zero — a zero would read as "no calls happened".

Because GA measures something different from the database, its metrics render in
their own `Engagement (GA4)` section. This also keeps `Calls & Recordings` under
Slack's 10-fields-per-section cap.

## Configuration safety

**Recordings buckets are never inferred.** `WEBRTC_RECORDINGS_S3_BUCKET` and
`KALEYRA_RECORDINGS_S3_BUCKET` must each be set explicitly; a metric whose
bucket is missing is dropped from the report. There is deliberately no fallback
to `AWS_BUCKET_NAME` — that is the documents bucket, and falling back to it
would report the day's document uploads as a recording count, which reads as a
plausible number rather than as a misconfiguration.

**Idempotency keys on a completed report, not on the row existing.** A run that
fails part-way leaves a row behind; the next run retries it in place and only a
report already marked `completed` is skipped. Without this, one transient S3
error would make that date permanently unreportable without `--force`.

## Running on more than one host

The deploy workflows push each service to several hosts, so the scheduled job
fires on all of them at the same moment. The unique key on `cron_reports`
prevents a duplicate row but not duplicate work — without a lock every instance
would still query the databases, list the bucket and post its own Slack message.

`runDailyOperationsReport` therefore takes a MySQL advisory lock
(`cron_microservice_daily_report`) for the length of the run, held on a single
pooled connection exactly as the migration runner holds its own lock. The
timeout is 0: an instance that loses the race returns
`{ skipped: true, reason: "locked" }` immediately and does no work, because
waiting and then running would recreate the duplicate the lock exists to stop.

This assumes the hosts share one portal database, which is what makes the lock
mutual. Hosts pointing at *separate* databases are separate deployments and each
will correctly produce its own report — set `SLACK_DAILY_REPORT_WEBHOOK_URL` per
environment so they do not all post into the same channel.

`CRONS_ENABLED=false` remains the simplest way to run the HTTP endpoints on a
host without scheduling anything there.

## Timezones across hosts

`CRON_TIMEZONE` is the single source of truth for *when a day starts*. It drives
the node-cron schedule and `reportPeriod`, which builds the window with
moment-timezone rather than the host clock — so a container running UTC and one
running IST produce the same window.

Each source is then queried in the zone it actually stores:

| Source | Stores | Bound with |
| --- | --- | --- |
| Portal (`call_data`, `call_recordings`) | UTC | `:startUtc` / `:endUtc` |
| OpenMRS (`patient`, `visit`, `visit_attribute`) | database-server local | `:startLocal` / `:endLocal` |
| S3 recording keys | producer local | parsed in `CRON_TIMEZONE` |
| GA4 | property timezone | `GA_PROPERTY_TIMEZONE`, asserted |

The local bounds are derived from the database's own clock
(`TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW())`), read once per connection per
run, not from `CRON_TIMEZONE`. Assuming the two agree holds only while the app
container and MySQL keep the same zone; deriving the offset keeps the same
instant correct when a host runs UTC and the database does not.

`period_start` and `period_end` are written as formatted strings in the report
timezone, so the stored value matches the `timezone` column on every host. Passing
JS `Date` objects would have let the driver serialise them in the host's zone,
making the same report read differently depending on which server produced it.

## Slack delivery

Setting `SLACK_DAILY_REPORT_WEBHOOK_URL` is all it takes — the report sends, and
`slack_status` records `sent`. Delivery is the job's purpose, not something to
opt into.

`DAILY_REPORT_SLACK_DEBUG=true` is an explicit override for trial runs. It marks
the message (🧪 header, `[DEBUG]` fallback text) so it cannot be mistaken for a
real report, and prefers `SLACK_DAILY_REPORT_DEBUG_WEBHOOK_URL` — falling back to
the normal webhook when no debug one is set, so a test still lands somewhere
visible. With neither configured it prints the payload and records `debug`.

| `SLACK_DAILY_REPORT_WEBHOOK_URL` | `DAILY_REPORT_SLACK_DEBUG` | Result |
| --- | --- | --- |
| set | `false` | posts unmarked, `sent` |
| set | `true` | posts marked to the debug webhook, or to this one if no debug URL, `debug` |
| unset | `false` | `skipped` |
| unset | `true` | payload printed to the log, `debug` |

The routing and the message marking come from one `slackTarget()` call, so a
message can never be marked one way and routed the other.

## What is stored

`cron_reports` keeps one row per `report_date` and stores **counts only**:

```json
{
  "counts": { "start_calls": 81, "webrtc_recordings": 35, "recordings_avg_duration": 37 },
  "breakdowns": { "webrtc_recordings": { "Badagi": 31, "Jambhulpada": 2, "Remote": 2 } }
}
```

Labels, sections, sources and units are **not** persisted — they come from the
metric configuration at render time. Storing them would copy the config into
every row and freeze wording that is meant to stay editable; renaming a label
would then leave history disagreeing with the present.

Per-location `breakdowns` are kept because they are measurements rather than
configuration, and cannot be recovered once the bucket is pruned.

The rendered Slack message and Block Kit payload are not stored either. Both are
pure functions of the counts and the period, nothing read them back, and keeping
them meant maintaining two derived copies of the same report. Dropping them took
a row from 4,219 to 373 bytes — about 133 KB a year instead of 1.5 MB.

To show a metric later, read `metrics->>'$.counts.<name>'` and take the label
from the current configuration.
