// WhatsApp 24h customer-service window, per patient number.
//
// WhatsApp only delivers free-form (non-template) messages within 24h of the
// patient's LAST INBOUND message. Our own sends (prescription PDF, reminders) do
// not open or extend it, so only patient activity is recorded here:
//   - Turn journey calls that carry the chatting number (whatsapp_id), and
//   - Turn's inbound-message webhook (POST /webhooks/turn/inbound), when configured.
//
// A safety margin (default 23h instead of 24h) covers clock skew and the delay
// between the patient's message and the journey call reaching us.

const fs = require("fs");
const path = require("path");

const STORE_PATH = path.join(__dirname, ".turn-session.json");
const WINDOW_HOURS = Number(process.env.SESSION_WINDOW_HOURS) || 23;
const WINDOW_MS = Math.min(WINDOW_HOURS, 24) * 60 * 60 * 1000;

const digits = (n) => String(n || "").replace(/\D/g, "");
// Same rule as turn.toWhatsAppNumber: bare 10-digit numbers get the 91 prefix.
const key = (n) => { const d = digits(n); return d.length === 10 ? `91${d}` : d; };

const load = () => {
   try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); } catch { return {}; }
};

// Records patient activity for `number` at `at` (ms or ISO; default now). Keeps the
// latest time seen and drops expired entries so the file stays small.
const touchSession = (number, at = Date.now()) => {
   const k = key(number);
   if (k.length < 10) return;
   const atMs = new Date(at).getTime();
   if (!Number.isFinite(atMs)) return;

   const now = Date.now();
   const store = load();
   const prev = store[k] ? new Date(store[k]).getTime() : 0;
   if (atMs <= prev) return;
   store[k] = new Date(Math.min(atMs, now)).toISOString();
   for (const [n, t] of Object.entries(store)) {
      if (now - new Date(t).getTime() >= WINDOW_MS) delete store[n];
   }
   try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(store), "utf8");
   } catch (err) {
      console.error("[turn session] write failed:", err.message);
   }
};

// Last recorded patient activity for `number`, or null.
const lastActivity = (number) => load()[key(number)] || null;

const inSessionWindow = (number) => {
   const at = lastActivity(number);
   return Boolean(at) && Date.now() - new Date(at).getTime() < WINDOW_MS;
};

// Unresolved Turn placeholders ("@contact.whatsapp_id") are not numbers.
const realNumber = (v) => (typeof v === "string" || typeof v === "number") && !String(v).trim().startsWith("@") ? v : null;

// Express middleware for /webhooks/turn: a journey call carrying whatsapp_id means
// that patient is chatting right now. Only whatsapp_id counts -- `number`/`mobile`
// can be doctor- or admin-supplied (e.g. /prescription/notify) and say nothing
// about the patient's window.
const recordJourneyActivity = (req, _res, next) => {
   try {
      const b = req.body || {};
      const n = realNumber(b.whatsapp_id) || realNumber(b.contact?.whatsapp_id) || realNumber(req.query?.whatsapp_id);
      if (n) touchSession(n);
   } catch (err) {
      console.error("[turn session] journey touch failed:", err.message);
   }
   next();
};

module.exports = { touchSession, inSessionWindow, lastActivity, recordJourneyActivity, WINDOW_MS };
