const express = require("express");
const { getVisit } = require("./openmrs");
const { buildPrescriptionData, hasPrescription } = require("./data");
const { generatePrescriptionPdf } = require("./pdf");

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

// No-op: the doctor webapp still calls this on share, but the Turn journey now
// delivers the PDF (via /prescription/<uuid>.pdf), so there is nothing to push.
// Return 200 so the webapp doesn't log a failed notification.
router.post("/prescription/notify", (req, res) => {
   console.log("\n[prescription notify] received (no-op, journey delivers):", JSON.stringify({ ...req.query, ...req.body }));
   res.json({ success: true, skipped: true, reason: "delivered-by-journey" });
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
