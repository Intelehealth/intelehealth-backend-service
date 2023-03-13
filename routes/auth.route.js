const router = require('express').Router();
const { requestOtp, verifyOtp, resetPassword } = require("../controllers/auth.controller");

router.post('/requestOtp', requestOtp);
router.post('/verifyOtp', verifyOtp);
router.post('/resetPassword/:userUuid', resetPassword);

module.exports = router;