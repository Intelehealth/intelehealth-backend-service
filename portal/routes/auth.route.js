const router = require("express").Router();
const {
  requestOtp,
  verifyOtp,
  resetPassword,
  checkSession,
  rememberme,
  checkProviderAttribute
} = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth");

router.post("/requestOtp", [authMiddleware, requestOtp]);
router.post("/verifyOtp", [authMiddleware, verifyOtp]);
router.post("/resetPassword/:userUuid", [authMiddleware, resetPassword]);
router.get("/check", [authMiddleware, checkSession]);
router.post("/rememberme", [authMiddleware, rememberme]);
router.post("/validateProviderAttribute", [authMiddleware, checkProviderAttribute]);

module.exports = router;