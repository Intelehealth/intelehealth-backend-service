const express = require("express");
const { getVisit } = require("./openmrs");
const { buildPrescriptionData, hasPrescription } = require("./data");
const { generatePrescriptionPdf } = require("./pdf");
const { notifyPrescriptionReady, notifyFollowUpScheduled } = require("./turn");

const NOT_READY_MSG =
   "Prescription not generated yet. Once it's ready, the doctor will send it to you.";

// Not-ready reply (no PDF); the Turn journey branches on /prescription/status first.
const sendNotReady = (res) => res.status(200).type("text/plain").send(NOT_READY_MSG);

// Blank/unresolved Turn placeholders ("@results.foo") count as missing.
const isBlank = (v) =>
   v == null || (typeof v === "string" && (v.trim() === "" || v.trim().startsWith("@")));
const clean = (v) => (isBlank(v) ? "" : String(v).trim());

// "2026-08-25" -> "25 Aug 2026" for the patient-facing follow-up message.
const fmtFollowUpDate = (iso) => {
   const d = new Date(`${iso}T00:00:00Z`);
   return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
};

const publicBase = (req) =>
   (clean(process.env.PUBLIC_BASE_URL) || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
const pdfUrl = (req, visitUuid) => `${publicBase(req)}/webhooks/turn/prescription/${visitUuid}.pdf`;
const pdfName = (data, visitUuid) => `e-prescription_${data.patientId || visitUuid}.pdf`;

// Tracks visits already pushed so a doctor-share retry never double-sends (in-memory: single-instance only).
const notifiedVisits = new Set();

// Sends the prescription PDF, then the follow-up message if the doctor scheduled one.
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

   // Send the follow-up message too, if the doctor scheduled one; a failure here shouldn't fail the prescription push.
   const fu = data.followUp;
   let followUpNotified = null;
   if (fu?.wantFollowUp === "Yes" && fu.followUpDateIso) {
      try {
         await notifyFollowUpScheduled({ number, patientName: data.patientName, date: fmtFollowUpDate(fu.followUpDateIso) });
         followUpNotified = fu.followUpDateIso;
      } catch (err) {
         console.error(`[prescription notify] ${visitUuid}: follow-up message failed:`, errDetail(err));
      }
   }

   return { ok: true, notified: number, followUp: followUpNotified };
};

// Deferred "reshare a missed prescription" background retry was removed -- see git history to restore it.

const errDetail = (err) => err.response?.data || err.message;
const fail = (res, tag, err) => {
   console.error(`[${tag}] error:`, errDetail(err));
   res.status(500).json({ success: false, error: errDetail(err) });
};

const router = express.Router();

// { shared, ready, pdf_url, filename, followUp } for a visit; backs both the webhook and /status.
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
         followUp: data.followUp
            ? { wantFollowUp: data.followUp.wantFollowUp, followUpDateIso: data.followUp.followUpDateIso }
            : null,
      });
   } catch (err) {
      fail(res, tag, err);
   }
};

router.post("/prescription", (req, res) => respondWithStatus(req, res, req.body || {}, "prescription"));
router.all("/prescription/status", (req, res) =>
   respondWithStatus(req, res, { ...req.query, ...req.body }, "prescription status")
);

// Doctor-share push: sends the PDF (and follow-up message) via Turn. Body: { visit_uuid, number? }; idempotent per visit.
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
         // Not shared yet; the doctor must share again (no background retry).
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
      res.json({ success: true, notified: result.notified, follow_up: result.followUp, visit_uuid: visitUuid });
   } catch (err) {
      fail(res, "prescription notify", err);
   }
});

// Streams the PDF with headers so WhatsApp renders it as an in-chat document.
const sendPdf = (res, pdf, p_name) => {
   res.setHeader("Content-Type", "application/pdf");
   res.setHeader("Content-Disposition", `attachment; filename="e-prescription_${p_name}.pdf"`);
   res.setHeader("Content-Length", pdf.length);
   res.setHeader("Accept-Ranges", "bytes");
   res.setHeader("Cache-Control", "no-cache");
   res.send(pdf);
};

// GET /prescription/<visitUuid>.pdf -- serves the PDF once shared, else a not-ready reply.
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
