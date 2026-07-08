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

module.exports = { notifyPrescriptionReady, normalizeNumber };
