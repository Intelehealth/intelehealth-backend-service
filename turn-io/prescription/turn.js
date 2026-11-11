const axios = require("axios");
const { inSessionWindow, lastActivity } = require("./session");

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

// In-session follow-up: the same Hindi copy and button as the template, as a plain
// interactive message (no template cost / approval needed). The button title matches
// the template's quick-reply text so the journey sees the same label; the reply id
// lets it also match on id. Note the tap arrives as type "interactive"
// (interactive.button_reply), not "button" like a template quick reply.
const FOLLOWUP_BUTTON_ID = "followup_start";
const FOLLOWUP_BUTTON_TITLE = process.env.FOLLOWUP_BUTTON_TITLE || "फॉलो-अप";
const sendFollowUpSessionMessage = async ({ to, patientName, doctorName, date }) => {
   const body = `नमस्ते ${patientName || ""}, आपने ${doctorName || "डॉक्टर"} से सलाह ली थी। ` +
      `आपका फॉलो-अप ${date} को है। शुरू करने के लिए नीचे दिए बटन पर क्लिक करें।`;
   const { data } = await postMessage({
      to,
      type: "interactive",
      interactive: {
         type: "button",
         body: { text: body },
         action: { buttons: [{ type: "reply", reply: { id: FOLLOWUP_BUTTON_ID, title: FOLLOWUP_BUTTON_TITLE } }] },
      },
   });
   return { messageId: data?.messages?.[0]?.id || null, response: data };
};

// Session messages are on unless FOLLOWUP_SESSION_MESSAGES=false.
const sessionMessagesEnabled = () => process.env.FOLLOWUP_SESSION_MESSAGES !== "false";

// Buttoned reminder with a "Start Follow Up Visit" quick reply. Inside the patient's
// 24h window (see session.js) it goes as a free-form interactive message; otherwise,
// or if that send is rejected, as the Hindi utility template named by
// FOLLOWUP_TEMPLATE_NAME ({{1}} patient, {{2}} doctor, {{3}} follow-up date).
// Returns `template` ("session-message" or the template name) so each send records how it went.
const notifyFollowUpStart = async ({ number, patientName, doctorName, date }) => {
   if (!TURN_API_TOKEN) throw new Error("TURN_API_TOKEN is not set");
   const to = normalizeNumber(number);
   if (!to) throw new Error("recipient number is required");

   if (sessionMessagesEnabled() && inSessionWindow(to)) {
      try {
         const result = await sendFollowUpSessionMessage({ to, patientName, doctorName, date });
         console.log(`[followup session] ${to}: in 24h window (last activity ${lastActivity(to)}) -- sent session message`);
         return { ...result, template: "session-message" };
      } catch (err) {
         // Window closed early, number unknown to Turn, etc. -- the template always works.
         console.warn(`[followup session] ${to}: session message rejected, falling back to template:`,
            JSON.stringify(err.response?.data || err.message));
      }
   }

   const template = process.env.FOLLOWUP_TEMPLATE_NAME;
   if (!template) throw new Error("FOLLOWUP_TEMPLATE_NAME is not set");
   const result = await sendTemplate({
      number: to,
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
   sessionMessagesEnabled,
   notifyPostConsultationSurvey,
   normalizeNumber,
   toWhatsAppNumber,
};
