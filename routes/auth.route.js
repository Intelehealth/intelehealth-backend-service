const router = require("express").Router();
const {
  requestOtp,
  verifyOtp,
  resetPassword,
  checkSession,
  rememberme,
  checkProviderAttribute
} = require("../controllers/auth.controller");

router.post("/requestOtp", requestOtp);
router.post("/verifyOtp", verifyOtp);
router.post("/resetPassword/:userUuid", resetPassword);
router.get("/check", checkSession);
router.post("/rememberme", rememberme);
router.post("/validateProviderAttribute", checkProviderAttribute);

module.exports = router;
