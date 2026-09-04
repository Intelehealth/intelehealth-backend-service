const express = require("express");
const { getVisit } = require("./openmrs");
const { buildPrescriptionData, hasPrescription, fmtFollowUpDate } = require("./data");
const { generatePrescriptionPdf } = require("./pdf");
const { notifyPrescriptionReady, notifyFollowUpScheduled } = require("./turn");
const { runFollowUpReminders, getCronInfo } = require("./followup-cron");

const NOT_READY_MSG =
   "Prescription not generated yet. Once it's ready, the doctor will send it to you.";
const sendNotReady = (res) => res.status(200).type("text/plain").send(NOT_READY_MSG);

// Blank/unresolved Turn placeholders ("@results.foo") count as missing.
const isBlank = (v) =>
   v == null || (typeof v === "string" && (v.trim() === "" || v.trim().startsWith("@")));
const clean = (v) => (isBlank(v) ? "" : String(v).trim());

const publicBase = (req) =>
   (clean(process.env.PUBLIC_BASE_URL) || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
const pdfUrl = (req, visitUuid) => `${publicBase(req)}/webhooks/turn/prescription/${visitUuid}.pdf`;

// Patient's full name, filesystem/URL-safe, for the downloaded filename. 
const fileSafeName = (data, visitUuid) =>
   clean(data.patientName).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || data.patientId || visitUuid;
const pdfName = (data, visitUuid) => `e-prescription_${fileSafeName(data, visitUuid)}.pdf`;

// Tracks visits already pushed so a doctor-share retry never double-sends (in-memory: single-instance only).
const notifiedVisits = new Set();

// Sends the prescription PDF, then the follow-up message if the doctor scheduled one.
// `visit`, when the caller already has it (e.g. fetched right after creating the
// visit-complete encounter), is used as-is instead of re-reading OpenMRS -- avoids
// a race with that encounter write not yet being visible on a fresh read.
// `resend` skips the already-notified dedup, for an explicit "Update Prescription" resend.
const notifyForVisit = async (visitUuid, { number: overrideNumber, baseUrl, visit, resend } = {}) => {
   if (!resend && notifiedVisits.has(visitUuid)) return { ok: true, skipped: true };
   const data = buildPrescriptionData(visit || (await getVisit(visitUuid)));
   if (!hasPrescription(data)) return { ok: false, status: 409 };
   const number = clean(overrideNumber) || data.phone;
   if (!number) return { ok: false, status: 422 };

   const base = (clean(baseUrl) || clean(process.env.PUBLIC_BASE_URL)).replace(/\/+$/, "");
   await notifyPrescriptionReady({
      number,
      pdfUrl: `${base}/webhooks/turn/prescription/${visitUuid}.pdf`,
      filename: pdfName(data, visitUuid),
      name: data.patientName,
   });
   notifiedVisits.add(visitUuid); // only after a successful send, so a failed push can retry

   // Send the follow-up message.
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

// Doctor-share push: sends the PDF (and follow-up message) via Turn. Body: { visit_uuid, number?, visit?, resend? };
router.post("/prescription/notify", async (req, res) => {
   const src = { ...req.query, ...req.body };
   // Don't log `visit` -- it's the full patient/visit payload (PHI) when the caller supplies one.
   console.log("\n[prescription notify] received:", JSON.stringify({ ...src, visit: src.visit ? "[provided]" : undefined }));
   try {
      const visitUuid = clean(src.visit_uuid);
      if (!visitUuid) {
         return res.status(400).json({ success: false, error: "visit_uuid is required" });
      }
      const opts = { number: src.number, baseUrl: publicBase(req), visit: src.visit || null, resend: Boolean(src.resend) };
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
const sendPdf = (res, pdf, filename) => {
   res.setHeader("Content-Type", "application/pdf");
   res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
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
      sendPdf(res, await generatePrescriptionPdf(data), pdfName(data, visitUuid));
   } catch (err) {
      // err can be a non-Error thrown by pdfmake, so log it directly rather than
      // errDetail(err) alone (which resolves to undefined for those cases).
      console.error(`[prescription pdf] error for visit ${visitUuid}:`, errDetail(err) ?? err);
      sendNotReady(res);
   }
});

// Manual trigger for the follow-up reminder cron -- lets Postman/curl run a pass
// on demand instead of waiting for 09:50. Body: { visit_uuid?, force?, dryRun? }.
router.post("/followup/run", async (req, res) => {
   const src = { ...req.query, ...req.body };
   console.log("\n[followup run] received:", JSON.stringify(src));
   try {
      const result = await runFollowUpReminders({
         visitUuid: clean(src.visit_uuid || src.visitUuid) || null,
         force: Boolean(src.force),
         dryRun: Boolean(src.dryRun),
         trigger: "manual",
      });
      res.json(result);
   } catch (err) {
      fail(res, "followup run", err);
   }
});

// Is the cron alive, when does it fire next, what did today's sent-log record.
router.get("/followup/status", (_req, res) => {
   try {
      res.json(getCronInfo());
   } catch (err) {
      fail(res, "followup status", err);
   }
});

module.exports = router;
