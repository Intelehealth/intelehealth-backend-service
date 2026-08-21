const axios = require("axios");

// Turn WhatsApp API. TURN_API_TOKEN is the workspace API token (app.turn.io ->
// Settings -> API). Proactive free-form messages only deliver inside the patient's
// 24h WhatsApp session window (open right after they chat with the bot).
const { TURN_API_TOKEN } = process.env;
const TURN_API_URL = process.env.TURN_API_URL || "https://whatsapp.turn.io/v1/messages";

// WhatsApp wants digits only (no "+", spaces, or "whatsapp:").
const normalizeNumber = (n) => String(n || "").replace(/\D/g, "");

const postMessage = (payload) =>
   axios.post(TURN_API_URL, payload, {
      headers: {
         Authorization: `Bearer ${TURN_API_TOKEN}`,
         "Content-Type": "application/json",
      },
   });

// Notify the patient on WhatsApp that their prescription is ready: a short text
// then the PDF as an in-chat document. Throws on API error so the caller logs it.
const notifyPrescriptionReady = async ({ number, pdfUrl, filename, name }) => {
   if (!TURN_API_TOKEN) throw new Error("TURN_API_TOKEN is not set");
   const to = normalizeNumber(number);
   if (!to) throw new Error("recipient number is required");

   const greeting = name ? `Hello ${name}, ` : "";
   await postMessage({
      to,
      type: "text",
      text: { body: `${greeting}your prescription is ready. Sending it now.` },
   });

   await postMessage({
      to,
      type: "document",
      document: { link: pdfUrl, filename: filename || "e-prescription.pdf" },
   });
};

// Tell the patient a follow-up visit has been scheduled (sent inside the session window).
const notifyFollowUpScheduled = async ({ number, patientName, date }) => {
   if (!TURN_API_TOKEN) throw new Error("TURN_API_TOKEN is not set");
   const to = normalizeNumber(number);
   if (!to) throw new Error("recipient number is required");

   const forWhom = patientName ? ` for ${patientName}` : "";
   await postMessage({
      to,
      type: "text",
      text: { body: `Doctor has advised a follow-up visit on ${date}${forWhom}.` },
   });
};

// Approved WhatsApp template send (works outside the 24h session window). bodyParams fill {{1}}, {{2}}, ... in order.
const sendTemplate = async ({ number, name, language, bodyParams = [] }) => {
   if (!TURN_API_TOKEN) throw new Error("TURN_API_TOKEN is not set");
   const to = normalizeNumber(number);
   if (!to) throw new Error("recipient number is required");

   await postMessage({
      to,
      type: "template",
      template: {
         name,
         language: { policy: "deterministic", code: language },
         components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text: String(text) })) }],
      },
   });
};

// Same-day follow-up reminder (approved template: followup_reminder). {{1}} patient, {{2}} doctor, {{3}} date.
const notifyFollowUpReminder = ({ number, patientName, doctorName, date }) =>
   sendTemplate({ number, name: "followup_reminder", language: "en", bodyParams: [patientName || "", doctorName || "", date] });

module.exports = {
   notifyPrescriptionReady,
   notifyFollowUpScheduled,
   sendTemplate,
   notifyFollowUpReminder,
   normalizeNumber,
};
