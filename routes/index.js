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
} = require("../controllers/mindmap.controller");

router.post("/mindmap/upload", addUpdateMindMap);
router.get("/mindmap", getMindmapKeys);

router.post("/mindmap/addUpdatekey", addUpdateLicenceKey);
router.get("/mindmap/details/:key", getMindmapDetails);
router.post("/mindmap/delete/:key", deleteMindmapKey);
router.get("/mindmap/download", downloadMindmaps);
router.post("/mindmap/toggleStatus", toggleMindmapActiveStatus);

router.use("/mindmap", require("./notification.route"));
router.use("/messages", require("./message.route"));
router.use("/openmrs", require("./openmrs.route"));
router.use("/appointment", require("./appointment.route"));
router.use('/auth', require("./auth.route"));
router.use("/links", require("./links.route"));
router.use("/support", require("./support.route"));
router.use("/openai", require("./openai.route"));
router.use('/signature', require("./signature.route"));

module.exports = router;
