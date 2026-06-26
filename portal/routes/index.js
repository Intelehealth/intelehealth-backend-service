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
const { getSequelize, getStore } = require("../db/context");

// Tenant-aware DB health check. Runs after tenantMiddleware, so it pings
// whichever tenant DB the request's Host header resolved to.
//   curl https://ezazi.<domain>/api/health/db   -> { tenant: "ezazi",  db: "mindmap_server" }
//   curl https://nezazi.<domain>/api/health/db  -> { tenant: "nezazi", db: "openmrsne" }
router.get("/health/db", async (req, res) => {
  const tenant = (getStore() || {}).tenant || null;
  const start = Date.now();
  try {
    const sequelize = getSequelize();
    if (!sequelize) throw new Error("no tenant DB context on request");
    const [rows] = await sequelize.query("SELECT DATABASE() AS db, VERSION() AS version");
    res.json({ ok: true, tenant, db: rows[0].db, mysql: rows[0].version, ms: Date.now() - start });
  } catch (err) {
    res.status(503).json({ ok: false, tenant, error: err.message, ms: Date.now() - start });
  }
});

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
