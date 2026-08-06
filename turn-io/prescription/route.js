const express = require("express");
const { getVisit } = require("./openmrs");
const { buildPrescriptionData, hasPrescription } = require("./data");
const { generatePrescriptionPdf } = require("./pdf");
const { notifyPrescriptionReady } = require("./turn");

const NOT_READY_MSG =
   "Prescription not generated yet. Once it's ready, the doctor will send it to you.";

// Plain-text reply for the not-ready / error case (no PDF). The Turn journey
// should branch on /prescription/status and only call document() when ready.
const sendNotReady = (res) => res.status(200).type("text/plain").send(NOT_READY_MSG);

// Blank/unresolved Turn placeholders ("@results.foo") count as missing.
const isBlank = (v) =>
   v == null || (typeof v === "string" && (v.trim() === "" || v.trim().startsWith("@")));
const clean = (v) => (isBlank(v) ? "" : String(v).trim());

const publicBase = (req) =>
   (clean(process.env.PUBLIC_BASE_URL) || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
const pdfUrl = (req, visitUuid) => `${publicBase(req)}/webhooks/turn/prescription/${visitUuid}.pdf`;
const pdfName = (data, visitUuid) => `e-prescription_${data.patientId || visitUuid}.pdf`;

// Idempotency: the doctor-share callback may fire more than once (retries,
// double clicks). Remember visits we've already pushed so the patient gets the
// prescription exactly once. In-memory: fine for a single instance; a
// multi-instance/ephemeral deploy would need a shared store (Redis/DB).
const notifiedVisits = new Set();

// Push the prescription to the patient on WhatsApp when the doctor shares.
// Loads the visit, verifies it's actually shared, resolves the number, sends the
// PDF, and records it so we never double-send. Returns a small result object.
const notifyForVisit = async (visitUuid, { number: overrideNumber, baseUrl } = {}) => {
   if (notifiedVisits.has(visitUuid)) return { ok: true, skipped: true };
   const data = buildPrescriptionData(await getVisit(visitUuid));
   if (!hasPrescription(data)) return { ok: false, status: 409 };
   const number = clean(overrideNumber) || data.phone;
   if (!number) return { ok: false, status: 422 };

   const base = (clean(baseUrl) || clean(process.env.PUBLIC_BASE_URL)).replace(/\/+$/, "");
   await notifyPrescriptionReady({
      number,
      pdfUrl: `${base}/webhooks/turn/prescription/${visitUuid}.pdf`,
      filename: `e-prescription_${data.patientId || visitUuid}.pdf`,
      name: data.patientName,
   });
   notifiedVisits.add(visitUuid); // only after a successful send, so a failed push can retry
   return { ok: true, notified: number };
};

// DISABLED -- deferred "reshare a missed prescription" retry.
//
// This covered the race where /notify fires before the doctor's Visit-Complete
// encounter has committed to OpenMRS: it polled in the background and pushed as
// soon as the visit became shared, so a prescription that looked "not shared
// yet" still reached the patient minutes later.
//
// Now we only share on the spot: if the visit isn't shared when /notify fires,
// we report it and stop. Nothing is delivered later.
//
// To re-enable: uncomment this block and the 409 branch in /prescription/notify.
//
// const RETRY_INTERVAL_MS = 60_000;
// const MAX_RETRIES = 10;
// const retryingVisits = new Set();
//
// const scheduleNotifyRetry = (visitUuid, opts, attempt = 1) => {
//    if (notifiedVisits.has(visitUuid)) { retryingVisits.delete(visitUuid); return; }
//    if (attempt > MAX_RETRIES) {
//       console.log(`[notify retry] ${visitUuid}: gave up after ${MAX_RETRIES} attempts (never shared)`);
//       retryingVisits.delete(visitUuid);
//       return;
//    }
//    retryingVisits.add(visitUuid);
//    setTimeout(async () => {
//       try {
//          const result = await notifyForVisit(visitUuid, opts);
//          if (result.ok && !result.skipped) {
//             console.log(`[notify retry] ${visitUuid}: sent on attempt ${attempt} to ${result.notified}`);
//             retryingVisits.delete(visitUuid);
//          } else if (result.skipped) {
//             retryingVisits.delete(visitUuid);
//          } else {
//             console.log(`[notify retry] ${visitUuid}: attempt ${attempt} still not shared, retrying`);
//             scheduleNotifyRetry(visitUuid, opts, attempt + 1);
//          }
//       } catch (err) {
//          console.error(`[notify retry] ${visitUuid}: attempt ${attempt} error:`, err.response?.data || err.message);
//          scheduleNotifyRetry(visitUuid, opts, attempt + 1);
//       }
//    }, RETRY_INTERVAL_MS);
// };

const errDetail = (err) => err.response?.data || err.message;
const fail = (res, tag, err) => {
   console.error(`[${tag}] error:`, errDetail(err));
   res.status(500).json({ success: false, error: errDetail(err) });
};

const router = express.Router();

// { shared, ready, pdf_url, filename } for a visit. `shared` = doctor clicked
// Share Prescription (visit-complete encounter). Backs the webhook + status.
const respondWithStatus = async (req, res, src, tag) => {
   console.log(`\n[${tag}] received:`, JSON.stringify(src));
   try {
      const visitUuid = clean(src.visit_uuid);
      if (!visitUuid) {
         return res.status(400).json({ success: false, error: "visit_uuid is required" });
      }
      const data = buildPrescriptionData(await getVisit(visitUuid));
      res.json({
         success: true,
         shared: Boolean(data.shared),
         ready: hasPrescription(data),
         visit_uuid: visitUuid,
         pdf_url: pdfUrl(req, visitUuid),
         filename: pdfName(data, visitUuid),
      });
   } catch (err) {
      fail(res, tag, err);
   }
};

router.post("/prescription", (req, res) => respondWithStatus(req, res, req.body || {}, "prescription"));
router.all("/prescription/status", (req, res) =>
   respondWithStatus(req, res, { ...req.query, ...req.body }, "prescription status")
);

// Doctor-share push: the webapp calls this when the doctor shares a prescription.
// Resolves the patient's WhatsApp number from the visit and sends them the PDF
// via Turn -- this is the "deliver later, whenever the doctor shares" path.
// Body: { visit_uuid, number? }. Idempotent per visit. 200 on send/skip; 409 if
// not shared yet, 422 if no number.
router.post("/prescription/notify", async (req, res) => {
   const src = { ...req.query, ...req.body };
   console.log("\n[prescription notify] received:", JSON.stringify(src));
   try {
      const visitUuid = clean(src.visit_uuid);
      if (!visitUuid) {
         return res.status(400).json({ success: false, error: "visit_uuid is required" });
      }
      const opts = { number: src.number, baseUrl: publicBase(req) };
      const result = await notifyForVisit(visitUuid, opts);
      if (result.skipped) {
         console.log(`[prescription notify] already notified ${visitUuid} -- skipping`);
         return res.json({ success: true, skipped: true, visit_uuid: visitUuid });
      }
      if (result.status === 409) {
         // Not shared yet. Share-only mode: we no longer queue a background
         // retry, so nothing is delivered later -- the doctor must share again.
         //
         // Previous deliver-later behaviour (re-enable with scheduleNotifyRetry):
         // if (!retryingVisits.has(visitUuid)) scheduleNotifyRetry(visitUuid, opts);
         // console.log(`[prescription notify] ${visitUuid} not shared yet -- scheduled background retry`);
         // return res.json({ success: true, pending: true, reason: "not-shared-yet-will-retry", visit_uuid: visitUuid });
         console.log(`[prescription notify] ${visitUuid} not shared yet -- no retry (share-only mode)`);
         return res.status(409).json({
            success: false,
            error: "Visit is not shared yet.",
            visit_uuid: visitUuid,
         });
      }
      if (result.status === 422) {
         return res.status(422).json({ success: false, error: "No WhatsApp number found for this patient." });
      }
      res.json({ success: true, notified: result.notified, visit_uuid: visitUuid });
   } catch (err) {
      fail(res, "prescription notify", err);
   }
});

// Stream the PDF. Always application/pdf + 200 so Turn's document() card never
// hard-fails; headers make WhatsApp render it as an in-chat document. This is
// the single prescription-delivery path -- the Turn journey fetches it here.
const sendPdf = (res, pdf, p_name) => {
   res.setHeader("Content-Type", "application/pdf");
   res.setHeader("Content-Disposition", `attachment; filename="e-prescription_${p_name}.pdf"`);
   res.setHeader("Content-Length", pdf.length);
   res.setHeader("Accept-Ranges", "bytes");
   res.setHeader("Cache-Control", "no-cache");
   res.send(pdf);
};

// GET /prescription/<visitUuid>.pdf. Serves the PDF only when shared; otherwise
// (unresolved id, not shared, or OpenMRS failure) replies with a plain-text
// not-ready message instead of a placeholder PDF.
router.get("/prescription/:visitUuid.pdf", async (req, res) => {
   const visitUuid = clean(req.params.visitUuid);
   try {
      if (!visitUuid) {
         console.warn(`[prescription pdf] unresolved id "${req.params.visitUuid}" -> not-ready`);
         return sendNotReady(res);
      }
      const data = buildPrescriptionData(await getVisit(visitUuid));
      if (!hasPrescription(data)) return sendNotReady(res);
      sendPdf(res, await generatePrescriptionPdf(data), data.patientName || visitUuid);
   } catch (err) {
      console.error("[prescription pdf] error:", errDetail(err));
      sendNotReady(res);
   }
});

module.exports = router;
