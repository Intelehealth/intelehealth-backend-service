const router = require("express").Router();
const {
  upsertResource,
  upsertAssetResource,
  getResource,
  getChildResources,
  getPendingResources,
  bulkMarkSynced,
  deleteResource,
} = require("../controllers/temp-storage.controller");
const { fileParser } = require("../handlers/file.handler");
const authMiddleware = require("../middleware/auth");
// POST /temp-storage — Upsert a resource
router.post("/", [authMiddleware, upsertResource]);

// POST /temp-storage/upload — Upsert asset resource with file upload
router.post("/upload", [authMiddleware, fileParser, upsertAssetResource]);

// GET /temp-storage/pending — Fetch all unsynced records
router.get("/pending", [authMiddleware, getPendingResources]);

// GET /temp-storage/:resourceType/:resourceId — Fetch a single resource
router.get("/:resourceType/:resourceId", [authMiddleware, getResource]);

// GET /temp-storage/:resourceType/:resourceId/children — Fetch child resources
router.get("/:resourceType/:resourceId/children", [authMiddleware, getChildResources]);

// PATCH /temp-storage/sync — Bulk mark records as synced
router.patch("/sync", [authMiddleware, bulkMarkSynced]);

// DELETE /temp-storage/:resourceType/:resourceId — Delete resource with cascade
router.delete("/:resourceType/:resourceId", [authMiddleware, deleteResource]);

module.exports = router;
