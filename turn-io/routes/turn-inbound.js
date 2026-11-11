// Turn inbound-message webhook -> records each patient message for the 24h window
// (prescription/session.js). This is the most accurate source: it fires on every
// patient message, with WhatsApp's own timestamp, not just on journey HTTP cards.
//
// Setup: app.turn.io -> Settings -> API & Webhooks -> add a webhook to
//   <PUBLIC_BASE_URL>/webhooks/turn/inbound
// and set TURN_HOOK_SECRET to its secret so the signature is checked.
//
// Body (WhatsApp format): { messages: [{ from, timestamp, ... }], statuses: [...] }

const crypto = require("crypto");
const express = require("express");
const { touchSession } = require("../prescription/session");

const router = express.Router();

// X-Turn-Hook-Signature = base64(HMAC-SHA256(secret, raw body)).
const validSignature = (req) => {
   const secret = process.env.TURN_HOOK_SECRET;
   if (!secret) return true; // not configured -> accept (only touches session times)
   const given = String(req.get("X-Turn-Hook-Signature") || "");
   const expected = crypto.createHmac("sha256", secret).update(req.rawBody || "").digest("base64");
   return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};

router.post("/inbound", (req, res) => {
   if (!validSignature(req)) {
      console.warn("[turn inbound] bad signature -- ignored");
      return res.sendStatus(401);
   }
   const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
   for (const m of messages) {
      // timestamp is unix seconds; fall back to now if missing.
      const at = Number(m?.timestamp) ? Number(m.timestamp) * 1000 : Date.now();
      if (m?.from) touchSession(m.from, at);
   }
   res.sendStatus(200); // Turn retries on non-2xx, so always ack once handled
});

module.exports = router;
