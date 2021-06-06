const express = require("express");
const router = express.Router();
const {
  getMindmapDetails,
  addUpdateLicenceKey,
  getMindmapKeys,
  addUpdateMindMap,
  deleteMindmapKey,
  downloadMindmaps,
  getLink,
  shortLink,
} = require("../controllers/mindmap.controller");

router.post("/mindmap/upload", addUpdateMindMap);
router.get("/mindmap", getMindmapKeys);
router.post("/mindmap/addUpdatekey", addUpdateLicenceKey);
router.get("/mindmap/details/:key", getMindmapDetails);
router.post("/mindmap/delete/:key", deleteMindmapKey);
router.get("/mindmap/download", downloadMindmaps);

/**
 * Links route
 */
router.get("/mindmap/getLink", getLink);
router.get("/mindmap/shortLink", shortLink);

router.use("/mindmap", require("./notification.route"));
router.use("/messages", require("./message.route"));

module.exports = router;
