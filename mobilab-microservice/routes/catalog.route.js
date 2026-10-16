const express = require("express");
const {
  getLabTests,
  getLabProfiles
} = require("../controllers/catalog.controller");
const {
  getLabTestsSchema,
  getLabProfilesSchema
} = require("../schema/catalog.schema");
const { authMiddleware } = require("../middleware/auth");
const { validate } = require("../middleware/validationMiddleware");
const router = express.Router();

router.get("/lab-tests", [authMiddleware, validate(getLabTestsSchema, "query"), getLabTests]);
router.get("/lab-profiles", [authMiddleware, validate(getLabProfilesSchema, "query"), getLabProfiles]);

module.exports = router;
