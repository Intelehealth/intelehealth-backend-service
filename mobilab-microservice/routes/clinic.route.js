const express = require("express");
const multer = require("multer");
const {
  getClinics,
  createClinic,
  uploadClinicFile,
  getClinic,
  updateClinic
} = require("../controllers/clinic.controller");
const {
  getClinicsSchema,
  clinicIdSchema,
  createClinicSchema,
  updateClinicSchema,
  uploadClinicFileSchema
} = require("../schema/clinic.schema");
const { authMiddleware } = require("../middleware/auth");
const { validate, requireFile } = require("../middleware/validationMiddleware");
const router = express.Router();

// Clinic files are kept in memory and streamed straight to Mobilab
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.MOBILAB_UPLOAD_MAX_MB) || 10) * 1024 * 1024, files: 1 }
});

router.get("/", [authMiddleware, validate(getClinicsSchema, "query"), getClinics]);
router.post("/", [authMiddleware, validate(createClinicSchema), createClinic]);
router.post("/upload-file", [authMiddleware, upload.single("file_obj"), requireFile("file_obj"), validate(uploadClinicFileSchema), uploadClinicFile]);
router.get("/:id", [authMiddleware, validate(clinicIdSchema, "params"), getClinic]);
router.patch("/:id", [authMiddleware, validate(clinicIdSchema, "params"), validate(updateClinicSchema), updateClinic]);

module.exports = router;
