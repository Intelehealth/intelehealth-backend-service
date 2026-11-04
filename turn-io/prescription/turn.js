const axios = require("axios");

// Turn WhatsApp API. TURN_API_TOKEN is the workspace API token (app.turn.io ->
// Settings -> API). Proactive free-form messages only deliver inside the patient's
// 24h WhatsApp session window (open right after they chat with the bot).
const { TURN_API_TOKEN, TURN_TEMPLATE_NAMESPACE } = process.env;
const TURN_API_URL = process.env.TURN_API_URL || "https://whatsapp.turn.io/v1/messages";

// WhatsApp wants digits only (no "+", spaces, or "whatsapp:").
const normalizeNumber = (n) => String(n || "").replace(/\D/g, "");

// Portal-registered numbers are often 10 digits; WhatsApp needs the country code.
const toWhatsAppNumber = (phone) => {
   const digits = normalizeNumber(phone);
   return digits.length === 10 ? `91${digits}` : digits;
};

const postMessage = (payload) =>
   axios.post(TURN_API_URL, payload, {
      headers: {
         Authorization: `Bearer ${TURN_API_TOKEN}`,
         "Content-Type": "application/json",
      },
   });

// Notify the patient on WhatsApp that their prescription is ready: 
// VTT intake visits always get the Hindi copy.
const notifyPrescriptionReady = async ({ number, pdfUrl, filename, name, resend, vtt }) => {
   if (!TURN_API_TOKEN) throw new Error("TURN_API_TOKEN is not set");
   const to = normalizeNumber(number);
   if (!to) throw new Error("recipient number is required");

   let caption;
   if (vtt) {
      const greeting = name ? `नमस्ते ${name}, ` : "";
      caption = resend
         ? `${greeting}आपका अपडेट किया गया प्रिस्क्रिप्शन तैयार है।`
         : `${greeting}आपका प्रिस्क्रिप्शन तैयार है।`;
   } else {
      const greeting = name ? `Hello ${name}, ` : "";
      caption = resend
         ? `${greeting}your updated prescription is ready.`
         : `${greeting}your prescription is ready.`;
   }

   await postMessage({
      to,
      type: "document",
      document: { link: pdfUrl, filename: filename || "e-prescription.pdf", caption },
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
   if (!TURN_TEMPLATE_NAMESPACE) throw new Error("TURN_TEMPLATE_NAMESPACE is not set");
   const to = normalizeNumber(number);
   if (!to) throw new Error("recipient number is required");

   // Turn's reply carries the WhatsApp message id (messages[0].id) -- returned so
   // callers can trace delivery of a specific send.
   const { data } = await postMessage({
      to,
      type: "template",
      template: {
         namespace: TURN_TEMPLATE_NAMESPACE,
         name,
         language: { policy: "deterministic", code: language },
         components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text: String(text) })) }],
      },
   });
   return { messageId: data?.messages?.[0]?.id || null, response: data };
};

// Same-day follow-up reminder (approved template: followup_reminder). {{1}} patient, {{2}} doctor, {{3}} date.
const notifyFollowUpReminder = ({ number, patientName, doctorName, date }) =>
   sendTemplate({ number, name: "followup_reminder", language: "en", bodyParams: [patientName || "", doctorName || "", date] });

// Buttoned reminder with a "Start Follow Up Visit" quick reply: Hindi utility template
// (default arogyapath_followup_reminder). {{1}} patient, {{2}} doctor, {{3}} follow-up date.
// Returns the template name too, so each send records which template it used.
const notifyFollowUpStart = async ({ number, patientName, doctorName, date }) => {
   const template = process.env.FOLLOWUP_TEMPLATE_NAME || "arogyapath_followup_reminder";
   const result = await sendTemplate({
      number,
      name: template,
      language: process.env.FOLLOWUP_TEMPLATE_LANGUAGE || "hi",
      bodyParams: [patientName || "", doctorName || "", date],
   });
   return { ...result, template };
};

// Post-consultation survey (IDTP-177): Hindi utility template (default
// arogyapath_post_consultation_intro). {{1}} patient name, {{2}} consultation date.
// Returns the template name too, so each send records which template it used.
const notifyPostConsultationSurvey = async ({ number, patientName, date }) => {
   const template = process.env.SURVEY_TEMPLATE_NAME || "arogyapath_post_consultation_intro";
   const result = await sendTemplate({
      number,
      name: template,
      language: process.env.SURVEY_TEMPLATE_LANGUAGE || "hi",
      bodyParams: [patientName || "", date],
   });
   return { ...result, template };
};

module.exports = {
   notifyPrescriptionReady,
   notifyFollowUpScheduled,
   sendTemplate,
   notifyFollowUpReminder,
   notifyFollowUpStart,
   notifyPostConsultationSurvey,
   normalizeNumber,
   toWhatsAppNumber,
};
