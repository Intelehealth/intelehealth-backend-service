# Mobilab Microservice – API Testing Guide

Test the 22 endpoints **in this order**. Later steps use values saved in earlier
steps (clinic id, user id, booking id, reading id).

All commands are `curl` for **Git Bash**. Run them in the same terminal so the
saved variables (`$TOKEN`, `$CLINIC_ID` …) are kept.

---

## Step 0 – Setup (one time)

**0.1 Fill `.env`** (copy `example.env` → `.env`):

```
NODE_ENV=development
PORT=3070
ALLOWED_ORIGINS=["http://localhost:4200"]
MOBILAB_BASE_URL=<Mobilab staging base URL>
MOBILAB_API_KEY=                      # leave empty for now – filled in Step 2
MOBILAB_CLIENT_ID=<from Mobilab>
MOBILAB_CLIENT_SECRET=<from Mobilab>
MOBILAB_SCHEMA_NAME=<from Mobilab>
```

**0.2 Public key** – the service verifies the IH login token with the same key as
auth-gateway. Copy it:

```bash
mkdir -p .pem && cp ../auth-gateway/.pem/public_key.pem .pem/public_key.pem
```

> If you log in against a **server** auth-gateway (not local), use that server's
> `public_key.pem` instead, otherwise every call returns `401 Invalid token`.

**0.3 Start the service**

```bash
npm install
npm run dev          # "Server listening on port 3070"
```

**0.4 Get an IH login token** (auth-gateway, local default port 3030):

```bash
TOKEN=$(curl -s -X POST http://localhost:3030/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<your username>","password":"<your password>"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
echo $TOKEN          # should print a long eyJ... string

BASE=http://localhost:3070/mobilab
```

---

## Step 1 – Health check

```bash
curl -s http://localhost:3070/health
```

**Expect:** `200` → `{"status":"healthy","service":"mobilab-microservice",...}`

---

## Step 2 – Issue a TEST API key  `POST /v1/auth/token`

Test mode = bookings complete instantly with fake results, so you can test the
whole flow without the phone app or the analyzer device.

| Field | Required | Example |
|---|---|---|
| `name` | yes | `"IH Staging Sandbox"` |
| `mode` | no | `"test"` (use this) |
| `scopes` | no | omit = all scopes |
| `rate_limit_per_hour` | no | `1000` |

```bash
curl -s -X POST $BASE/v1/auth/token \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"IH Staging Sandbox","mode":"test"}'
```

**Expect:** `201` → `data.api_key` starts with `mlab_`, `data.mode` is `"test"`.

**Then:** put `data.api_key` into `.env` as `MOBILAB_API_KEY=...` and **restart**
the service (`Ctrl+C`, `npm run dev`). The key is shown only once – if lost, issue a new one.

---

## Step 3 – Catalog

### 3.1 List lab tests  `GET /v1/lab-tests`
Optional query: `limit` (max 200), `offset`.
```bash
curl -s "$BASE/v1/lab-tests?limit=200" -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` → `data: [{ name, code, sample_type }]`, `meta: { total, offset, limit }`.
**Save:** two test codes, e.g. `ALB`, `GLU`.

### 3.2 List lab profiles  `GET /v1/lab-profiles`
```bash
curl -s "$BASE/v1/lab-profiles" -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` → `data: [{ id, code, name, tests: [{ name, code }] }]`.
**Save:** one profile code that does **not** contain your saved test codes, e.g. `LFT`.

---

## Step 4 – Roles  `GET /v1/roles`

```bash
curl -s "$BASE/v1/roles" -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` → `data: [{ id, name, slug, description }]`.
**Save:** id of the **Phlebotomist** role → `ROLE_ID=<id>`

---

## Step 5 – Clinics

### 5.1 List clinics  `GET /v1/clinics`
Optional query: `limit` (max 100), `offset`, `search`, `status` (`active`/`inactive`), `sort_by` (`latest`/`oldest`/`name_asc`/`name_desc`).
```bash
curl -s "$BASE/v1/clinics?status=active&sort_by=latest" -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` → list of clinics with `owner`, `status`, `meta`.

### 5.2 Upload clinic file  `POST /v1/clinics/upload-file`  (multipart)
| Field | Required | Example |
|---|---|---|
| `file_obj` | yes | any small PDF / image |
| `type` | yes | `license` / `gst` / `logo` |
| `content_type` | no | `application/pdf` |
```bash
curl -s -X POST $BASE/v1/clinics/upload-file \
  -H "Authorization: Bearer $TOKEN" \
  -F "file_obj=@/c/path/to/license.pdf" -F "type=license"
```
**Expect:** `200` → `data.s3_key` like `clinics/license/..._license.pdf`. **Save:** `S3_KEY=<s3_key>`

### 5.3 Create clinic  `POST /v1/clinics`
| Field | Required | Example |
|---|---|---|
| `name` | yes | `"IH Test Clinic"` |
| `city`, `state`, `country`, `zip_code` | yes | `"Mumbai"`, `"Maharashtra"`, `"India"`, `"400001"` |
| `clinic_code` | no | `"IH-TEST-001"` (must be unique) |
| `license_s3_key` | no | `$S3_KEY` from 5.2 |
| `owner` | no | omit or `null` → no owner |
| `phone_number`, `email`, `street_address`, `license_number`, `gst_number`, `gst_s3_key`, `logo_s3_key` | no | |
```bash
curl -s -X POST $BASE/v1/clinics \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"IH Test Clinic\",\"clinic_code\":\"IH-TEST-001\",\"city\":\"Mumbai\",\"state\":\"Maharashtra\",\"country\":\"India\",\"zip_code\":\"400001\",\"license_s3_key\":\"$S3_KEY\"}"
```
**Expect:** `201` → `data: { id, name, city, state, status: "active", owner: null }`.
**Save:** `CLINIC_ID=<data.id>`

### 5.4 Get clinic  `GET /v1/clinics/{id}`
```bash
curl -s $BASE/v1/clinics/$CLINIC_ID -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` → the clinic you created.

### 5.5 Update clinic  `PATCH /v1/clinics/{id}`  (send at least one field)
```bash
curl -s -X PATCH $BASE/v1/clinics/$CLINIC_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone_number":"912299887766","street_address":"12 MG Road"}'
```
**Expect:** `200` → updated fields returned.

---

## Step 6 – Users (phlebotomist)

### 6.1 Create user  `POST /v1/users`
| Field | Required | Example |
|---|---|---|
| `full_name` | yes | `"Test Phlebo"` |
| `email` **or** `phone_number` | at least one | `"919900001111"` (no `+`) |
| `clinic_ids` | yes (min 1) | `["<CLINIC_ID>"]` or `["IH-TEST-001"]` |
| `role_id` | no | `$ROLE_ID` |
| `password` | no | min 8 chars, only for dashboard login |
```bash
curl -s -X POST $BASE/v1/users \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"full_name\":\"Test Phlebo\",\"phone_number\":\"919900001111\",\"role_id\":$ROLE_ID,\"clinic_ids\":[\"$CLINIC_ID\"]}"
```
**Expect:** `201` → `data: { id, full_name, phone_number, role, clinics, is_active: true }`.
**Save:** `PHLEBO_ID=<data.id>`

### 6.2 List users  `GET /v1/users`
Optional query: `limit` (max 100), `offset`, `search`, `clinic_id`, `role_slug`, `category`, `sort_by`.
```bash
curl -s "$BASE/v1/users?clinic_id=$CLINIC_ID&search=919900001111" -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` → your new user in `data`.

### 6.3 Get user  `GET /v1/users/{id}`
```bash
curl -s $BASE/v1/users/$PHLEBO_ID -H "Authorization: Bearer $TOKEN"
```

### 6.4 Update user  `PATCH /v1/users/{id}`
Optional: `full_name`, `email`, `phone_number`, `role_id` (`null` removes role).
```bash
curl -s -X PATCH $BASE/v1/users/$PHLEBO_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"full_name":"Test Phlebo Updated"}'
```
**Expect:** `200` → `full_name` changed.

---

## Step 7 – Bookings

Use a unique `booking_id` every run:
```bash
BOOKING_ID=BK-TEST-$(date +%s)
```

### 7.1 Create booking – single phlebotomist  `POST /v1/bookings`
| Field | Required | Example |
|---|---|---|
| `booking_id` | yes | `$BOOKING_ID` (unique) |
| `patient_name` | yes | `"Test Patient"` |
| `patient_phone` | yes | `"919876500000"` (no `+`) |
| `dob` | yes | `"1990-06-15"` |
| `gender` | yes | `"male"` / `"female"` |
| `selected_tests.test_codes` | no | codes from 3.1 |
| `selected_tests.profile_codes` | no | codes from 3.2 (must not overlap test_codes) |
| `clinic_id` | no | `$CLINIC_ID` |
| `assigned_to` | no | `$PHLEBO_ID`; omit/`null` = whole clinic |
| `sys`, `dia`, `height`, `weight`, `spo2`, `questionaires`, `is_dummy` | no | |
```bash
curl -s -X POST $BASE/v1/bookings \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"booking_id\":\"$BOOKING_ID\",\"patient_name\":\"Test Patient\",\"patient_phone\":\"919876500000\",\"dob\":\"1990-06-15\",\"gender\":\"female\",\"selected_tests\":{\"test_codes\":[\"ALB\",\"GLU\"]},\"clinic_id\":$CLINIC_ID,\"assigned_to\":$PHLEBO_ID,\"sys\":120,\"dia\":80,\"spo2\":98.5}"
```
**Expect:** `201` →
- `assigned_to` = your phlebotomist, `assigned_to_list` = just them
- `is_test_mode: true`, `status: "completed"` (test key)

### 7.2 Create booking – whole clinic (`assigned_to: null`)
```bash
BOOKING_ID_2=BK-TEST-$(date +%s)-2
curl -s -X POST $BASE/v1/bookings \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"booking_id\":\"$BOOKING_ID_2\",\"patient_name\":\"Test Patient\",\"patient_phone\":\"919876500000\",\"dob\":\"1990-06-15\",\"gender\":\"female\",\"selected_tests\":{\"test_codes\":[\"ALB\"]},\"clinic_id\":$CLINIC_ID,\"assigned_to\":null}"
```
**Expect:** `201` → `assigned_to: null`, `assigned_to_list` = all active phlebotomists of the clinic (includes yours).

### 7.3 List bookings  `GET /v1/bookings`
Optional query: `status`, `start_date`, `end_date` (YYYY-MM-DD), `limit` (max 100), `offset`.
```bash
curl -s "$BASE/v1/bookings?limit=10&start_date=$(date +%F)" -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` → both bookings in `data`, `meta.total`.

### 7.4 Get booking  `GET /v1/bookings/{booking_id}`
```bash
curl -s $BASE/v1/bookings/$BOOKING_ID -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` → full booking incl. patient, vitals, `booking_type`.

### 7.5 Update booking  `PATCH /v1/bookings/{booking_id}`
Optional: `clinic_id`, `assigned_to` (`null` = unassign), `sys`, `dia`, `height`, `weight`, `spo2`, `questionaires`. (`status` can't be set.)
```bash
curl -s -X PATCH $BASE/v1/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"weight":59.2,"spo2":97}'
```
**Expect:** `200` → `weight`, `spo2` updated, `modified` changed.

---

## Step 8 – Results

### 8.1 Get results  `GET /v1/bookings/{booking_id}/results`
```bash
curl -s $BASE/v1/bookings/$BOOKING_ID/results -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` →
- `tests[]` with `id, test_code, value, unit, normal_range, method, status`
- test key: every `value` filled (inside normal range), `is_test_mode: true`
- `disclaimers[]` present

**Save:** `READING_ID=<tests[0].id>` and `READING_ID_2=<tests[1].id>`

### 8.2 Update reading  `PATCH /v1/bookings/{booking_id}/readings/{id}`
| Field | Required | Example |
|---|---|---|
| `action` | yes | `approve` / `reject` / `repeat` |
| `remarks` | no | max 500 chars |
```bash
curl -s -X PATCH $BASE/v1/bookings/$BOOKING_ID/readings/$READING_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"approve","remarks":"Value within expected range."}'

curl -s -X PATCH $BASE/v1/bookings/$BOOKING_ID/readings/$READING_ID_2 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"repeat","remarks":"Insufficient sample"}'
```
**Expect:** `200` → `status: "accepted"` / `"retest_required"`. Run 8.1 again to confirm.

---

## Step 9 – Report  `GET /v1/reports/{booking_id}`

```bash
curl -s $BASE/v1/reports/$BOOKING_ID -H "Authorization: Bearer $TOKEN"
```
**Expect:**
- `200` → `data.url` (presigned PDF, valid ~1 hour) – open it in a browser
- `404 not_found` is also **correct** if the report isn't generated yet (reports are generated after all readings are reviewed)

---

## Step 10 – Cleanup

### 10.1 Delete user  `DELETE /v1/users/{id}`
```bash
curl -s -i -X DELETE $BASE/v1/users/$PHLEBO_ID -H "Authorization: Bearer $TOKEN"
```
**Expect:** `204` (empty) or `200` → `{"data":{"detail":"User deleted successfully."}}`.

### 10.2 Deactivate clinic  `PATCH /v1/clinics/{id}`
```bash
curl -s -X PATCH $BASE/v1/clinics/$CLINIC_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"inactive"}'
```
**Expect:** `200` → `status: "inactive"`. Creating a booking with this `clinic_id` should now fail with `400`.

### 10.3 Revoke key  `DELETE /v1/auth/token` — **run last**
```bash
curl -s -X DELETE $BASE/v1/auth/token -H "Authorization: Bearer $TOKEN"
```
**Expect:** `200` → `{"data":{"detail":"API key revoked."}}`.
⚠️ This revokes the key in `.env`. Every call after this returns `502 invalid_api_key`
until you issue a new key (Step 2). Skip it if you want to keep testing.

---

## Negative checks (should be rejected)

| Request | Expected |
|---|---|
| Any call without `Authorization` | `401 Invalid authorization header` |
| Phone with `+`, e.g. `"patient_phone":"+919876500000"` | `422` – no leading `+` |
| `dob` as `15-06-1990` | `422` – YYYY-MM-DD |
| Booking with `"status":"completed"` in the body | `422` – not allowed |
| Same `booking_id` twice | `400 validation_error` (from Mobilab) |
| `GET /v1/clinics?limit=500` | `422` – max 100 |
| Reading `"action":"accept"` | `422` – must be approve / reject / repeat |
| Create user with no email and no phone | `422` |
| `PATCH /v1/bookings/{id}` with `{}` | `422` – at least one field |
| Upload without `file_obj` | `422` |
| Wrong / revoked `MOBILAB_API_KEY` in `.env` | `502 invalid_api_key` |

## Error format (all failures)

```json
{ "success": false, "code": 422, "error_code": "validation_error", "message": "..." }
```
`error_code` is Mobilab's code when the error came from Mobilab, otherwise absent.

## Checklist

| # | Endpoint | Status |
|---|---|---|
| 1 | GET /health | ☐ |
| 2 | POST /v1/auth/token | ☐ |
| 3 | GET /v1/lab-tests | ☐ |
| 4 | GET /v1/lab-profiles | ☐ |
| 5 | GET /v1/roles | ☐ |
| 6 | GET /v1/clinics | ☐ |
| 7 | POST /v1/clinics/upload-file | ☐ |
| 8 | POST /v1/clinics | ☐ |
| 9 | GET /v1/clinics/{id} | ☐ |
| 10 | PATCH /v1/clinics/{id} | ☐ |
| 11 | POST /v1/users | ☐ |
| 12 | GET /v1/users | ☐ |
| 13 | GET /v1/users/{id} | ☐ |
| 14 | PATCH /v1/users/{id} | ☐ |
| 15 | POST /v1/bookings (single) | ☐ |
| 16 | POST /v1/bookings (clinic-wide) | ☐ |
| 17 | GET /v1/bookings | ☐ |
| 18 | GET /v1/bookings/{booking_id} | ☐ |
| 19 | PATCH /v1/bookings/{booking_id} | ☐ |
| 20 | GET /v1/bookings/{booking_id}/results | ☐ |
| 21 | PATCH /v1/bookings/{booking_id}/readings/{id} | ☐ |
| 22 | GET /v1/reports/{booking_id} | ☐ |
| 23 | DELETE /v1/users/{id} | ☐ |
| 24 | DELETE /v1/auth/token (last) | ☐ |
