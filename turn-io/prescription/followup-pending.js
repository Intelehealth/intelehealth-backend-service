// Bridges a sent follow-up nudge to the button tap that answers it: the nudge
// is sent by phone number, but WhatsApp's reply doesn't carry the visit_uuid on
// its own -- so each send records who it was about here, keyed by phone.

const fs = require("fs");
const path = require("path");

const PENDING_STORE_PATH = path.join(__dirname, ".followup-pending.json");
const normalizeNumber = (n) => String(n || "").replace(/\D/g, "");

const loadStore = () => {
   try { return JSON.parse(fs.readFileSync(PENDING_STORE_PATH, "utf8")); } catch { return {}; }
};

const saveStore = (store) => fs.writeFileSync(PENDING_STORE_PATH, JSON.stringify(store), "utf8");

// Record (or overwrite) the pending follow-up for this phone number.
const recordPending = ({ phone, today, patientUuid, patientName, openmrsId, visitUuid, followUpDate, doctorName }) => {
   const number = normalizeNumber(phone);
   if (!number) throw new Error("recordPending: phone is required");

   const store = loadStore();
   store[number] = { recordedAt: today, patientUuid, patientName, openmrsId, visitUuid, followUpDate, doctorName };
   saveStore(store);
};

// Whole days from `from` to `to` (both "YYYY-MM-DD"). Positive = to is in the
// future, 0 = same day, negative = to is in the past. Computed at midnight UTC
// so DST/timezone shifts don't nudge the boundary by a day.
const daysBetween = (from, to) => {
   const a = new Date(`${from}T00:00:00Z`);
   const b = new Date(`${to}T00:00:00Z`);
   if (isNaN(a.getTime()) || isNaN(b.getTime())) return NaN;
   return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

module.exports = { recordPending, daysBetween };
