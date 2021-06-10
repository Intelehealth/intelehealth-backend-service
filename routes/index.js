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
  sendSMS,
  startCall,
} = require("../controllers/mindmap.controller");

router.post("/mindmap/upload", addUpdateMindMap);
router.get("/mindmap", getMindmapKeys);
router.post("/mindmap/addUpdatekey", addUpdateLicenceKey);
router.get("/mindmap/details/:key", getMindmapDetails);
router.post("/mindmap/delete/:key", deleteMindmapKey);
router.get("/mindmap/download", downloadMindmaps);

router.get("/mindmap/getLink", getLink);
router.post("/mindmap/shortLink", shortLink);
router.post("/mindmap/sendSMS", sendSMS);
router.post("/mindmap/startCall", startCall);

router.use("/mindmap", require("./notification.route"));

module.exports = router;
