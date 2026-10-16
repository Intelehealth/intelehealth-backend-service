const express = require("express");
const {
  ihLogin,
  issueToken,
  revokeToken
} = require("../controllers/auth.controller");
const {
  ihLoginSchema,
  issueTokenSchema,
  revokeTokenSchema
} = require("../schema/auth.schema");
const { authMiddleware } = require("../middleware/auth");
const { validate } = require("../middleware/validationMiddleware");
const router = express.Router();

// No authMiddleware - this is how the IH token is obtained
router.post("/login", [validate(ihLoginSchema), ihLogin]);
router.post("/token", [authMiddleware, validate(issueTokenSchema), issueToken]);
router.delete("/token", [authMiddleware, validate(revokeTokenSchema), revokeToken]);

module.exports = router;
