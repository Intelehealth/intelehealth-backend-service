const express = require("express");
const router = express.Router();

const {
  getMindmapDetails,
  addUpdateLicenceKey,
  getMindmapKeys,
  addUpdateMindMap,
  deleteMindmapKey,
  downloadMindmaps,
} = require("../controllers/mindmap.controller");
const authMiddleware = require("../middleware/auth");

router.post("/mindmap/upload", [authMiddleware, addUpdateMindMap]);
router.get("/mindmap", [authMiddleware, getMindmapKeys]);

router.post("/mindmap/addUpdatekey", [authMiddleware, addUpdateLicenceKey]);
router.get("/mindmap/details/:key", [authMiddleware, getMindmapDetails]);
router.post("/mindmap/delete/:key", [authMiddleware, deleteMindmapKey]);
router.get("/mindmap/download", [authMiddleware, downloadMindmaps]);

router.use("/mindmap", require("./notification.route"));
router.use("/messages", require("./message.route"));
router.use("/openmrs", require("./openmrs.route"));
router.use("/epartogram", require("./epartogram.route"));
router.use("/support", require("./support.route"));
router.use('/auth', require("./auth.route"));

module.exports = router;
