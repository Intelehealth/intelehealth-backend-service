# turn-webhook

Express service that receives [Turn.io](https://turn.io) flow webhooks and writes
patient registrations and visits into OpenMRS through the EMR-Middleware
`/push/pushdata` endpoint, so the doctor portal sees the data.

## Endpoints

All routes are mounted under `/webhooks/turn`:

| Method | Path                              | Purpose                                                      |
| ------ | --------------------------------- | ------------------------------------------------------------ |
| POST   | `/webhooks/turn/patient_registration` | Create an OpenMRS person + patient; returns `patient_uuid`.  |
| POST   | `/webhooks/turn/visit_push`           | Create the visit + encounters (chief complaint, history, vitals) for a `patient_uuid`. |

`GET /` returns a simple health string.

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values
npm start
```

The server listens on `PORT` (default `3000`).

## Configuration

All config is via environment variables — see [.env.example](.env.example) for the
full list. The real `.env` is gitignored and must never be committed.

## Project layout

```
server.js                       # app setup + route mounting
routes/patient-registration.js  # POST /patient_registration
routes/visit-push.js            # POST /visit_push
lib/openmrs.js                  # EMR-Middleware pushdata client
```
