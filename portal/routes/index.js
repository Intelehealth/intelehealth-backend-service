const express = require("express");
const router = express.Router();
const {
  getMindmapDetails,
  addUpdateLicenceKey,
  getMindmapKeys,
  addUpdateMindMap,
  deleteMindmapKey,
  downloadMindmaps,
  toggleMindmapActiveStatus,
  getTranslation,
  saveTranslation
} = require("../controllers/mindmap.controller");
const authMiddleware = require("../middleware/auth");
// const limiter = require("../middleware/rate-limiter");
// router.use(limiter);

router.post("/mindmap/upload", [authMiddleware, addUpdateMindMap]);
router.get("/mindmap", [authMiddleware, getMindmapKeys]);

router.post("/mindmap/addUpdatekey", [authMiddleware, addUpdateLicenceKey]);
router.get("/mindmap/details/:key", [authMiddleware, getMindmapDetails]);
router.post("/mindmap/delete/:key", [authMiddleware, deleteMindmapKey]);
router.get("/mindmap/download", [authMiddleware, downloadMindmaps]);
router.post("/mindmap/toggleStatus", [authMiddleware, toggleMindmapActiveStatus]);
router.post("/mindmap/translate", [authMiddleware, getTranslation]);
router.post("/mindmap/saveTranslation", [authMiddleware, saveTranslation]);

router.use("/mindmap", require("./notification.route"));
router.use("/messages", require("./message.route"));
router.use("/openmrs", require("./openmrs.route"));
router.use("/appointment", require("./appointment.route"));
router.use('/auth', require("./auth.route"));
router.use("/links", require("./links.route"));
router.use("/support", require("./support.route"));
router.use("/openai", require("./openai.route"));
router.use('/signature', require("./signature.route"));
router.use("/user", require("./user.route"));
router.use("/video-library", require("./videoLibrary.route"));

module.exports = router;
