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
// encounterUuid = the OpenMRS reminder encounter (followup-record.js), so the tap can be added to it.
const recordPending = ({ phone, today, patientUuid, patientName, openmrsId, visitUuid, followUpDate, doctorName, messageId, encounterUuid = null }) => {
   const number = normalizeNumber(phone);
   if (!number) throw new Error("recordPending: phone is required");

   const store = loadStore();
   store[number] = { recordedAt: today, patientUuid, patientName, openmrsId, visitUuid, followUpDate, doctorName, messageId, encounterUuid };
   saveStore(store);
};

// Merge fields into a pending entry (by its stored key), e.g. a backfilled encounterUuid
// or the uuid of the recorded tap. No-op if the entry is gone.
const updatePending = (key, fields) => {
   const store = loadStore();
   if (!store[key]) return;
   store[key] = { ...store[key], ...fields };
   saveStore(store);
};

const allPending = () => loadStore();

// The pending follow-up for a WhatsApp number. Portal-registered numbers are often
// stored without the country code, so a 91-prefixed reply also matches the 10-digit key.
const findPending = (phone) => {
   const number = normalizeNumber(phone);
   if (!number) return null;
   const store = loadStore();
   const key = [number, number.replace(/^91(?=\d{10}$)/, ""), `91${number}`].find((k) => store[k]);
   return key ? { phone: key, ...store[key] } : null;
};

// Stamp when the patient tapped "Start follow-up" (kept for tracking, not cleared,
// so a journey retry still finds the patient).
const markStarted = (phone) => {
   const store = loadStore();
   if (!store[phone]) return;
   store[phone] = { ...store[phone], startedAt: new Date().toISOString() };
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

module.exports = { recordPending, findPending, markStarted, updatePending, allPending, daysBetween };
