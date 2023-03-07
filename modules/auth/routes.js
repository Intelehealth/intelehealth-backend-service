const router = require('express').Router();
const api = require('./controller');

router.post('/requestOtp', api.requestOtp);
router.post('/verifyOtp', api.verifyOtp);
router.post('/resetPassword/:userUuid', api.resetPassword);

module.exports = router;