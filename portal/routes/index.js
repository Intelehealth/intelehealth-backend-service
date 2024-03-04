const express = require("express");
const router = express.Router();
const authMiddleware = require('../middleware/auth');

const {
  getMindmapDetails,
  addUpdateLicenceKey,
  getMindmapKeys,
  addUpdateMindMap,
  deleteMindmapKey,
  downloadMindmaps,
} = require("../controllers/mindmap.controller");

router.post("/mindmap/upload", [authMiddleware, addUpdateMindMap]);
router.get("/mindmap", [authMiddleware,getMindmapKeys]);

router.post("/mindmap/addUpdatekey", [authMiddleware,addUpdateLicenceKey]);
router.get("/mindmap/details/:key", [authMiddleware,getMindmapDetails]);
router.post("/mindmap/delete/:key", [authMiddleware,deleteMindmapKey]);
router.get("/mindmap/download", downloadMindmaps);

router.use("/mindmap", require("./notification.route"));
router.use("/messages", require("./message.route"));
router.use("/openmrs", require("./openmrs.route"));
router.use("/appointment", require("./appointment.route"));

module.exports = router;
