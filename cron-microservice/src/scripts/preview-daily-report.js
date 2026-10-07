require("dotenv").config();

const moment = require("moment-timezone");
const { buildMessage, buildSlackPayload, sendSlackReport } = require("../crons/services/report-slack.service");


const timezone = process.env.CRON_TIMEZONE || "UTC";
const report = {
  reportDate: moment().tz(timezone).format("YYYY-MM-DD"),
  timezone,
  metrics: [
    { name: "total_patients", label: "Patients registered today", section: "Patients & Visits", value: 36, source: "OpenMRS DB" },
    { name: "visits_with_prescription", label: "Visits with prescriptions today", section: "Patients & Visits", value: 128, source: "OpenMRS DB" },
    { name: "start_calls", label: "Start Call actions today", section: "Calls & Recordings", value: 74, source: "Portal DB" },
    { name: "recordings_started", label: "WebRTC recordings started today", section: "Calls & Recordings", value: 52, source: "Portal DB" },
    { name: "recordings_completed", label: "WebRTC recordings completed today", section: "Calls & Recordings", value: 49, source: "Portal DB" },
    { name: "recordings_avg_duration", label: "Average recording length", section: "Calls & Recordings", value: 37, unit: "s", source: "Portal DB" },
    { name: "recordings_under_30s", label: "Recordings under 30 seconds", section: "Calls & Recordings", value: 18, source: "Portal DB" },
    { name: "webrtc_recordings", label: "WebRTC recordings today", section: "Calls & Recordings", value: 47, source: "S3", detail: "Badagi 31 · Jambhulpada 2 · Remote 2" },
    { name: "kaleyra_recordings", label: "Kaleyra recordings today", section: "Calls & Recordings", value: 21, source: "S3" },
    { name: "whatsapp_calls", label: "WhatsApp calls recorded today", section: "Calls & Recordings", value: 39, source: "OpenMRS DB" },
    { name: "start_call_clicks", label: "Start Call button presses", section: "Engagement (GA4)", value: 88, source: "GA4" },
    { name: "whatsapp_calls_started", label: "WhatsApp calls started", section: "Engagement (GA4)", value: 41, source: "GA4" },
    { name: "kaleyra_calls_initiated", label: "Kaleyra calls initiated", section: "Engagement (GA4)", value: 23, source: "GA4" },
  ],
};
const payload = buildSlackPayload(report);

console.info(buildMessage(report));
sendSlackReport(payload).catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
