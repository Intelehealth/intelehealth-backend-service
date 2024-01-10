var express = require("express");

const { getToken, getOTP, getProfile, getAddress } = require("../controller/abha.controller");

const authMiddleware = require("../middleware/auth");

var router = express.Router();

router.get("/getToken", getToken);

router.get("/getOTP", [authMiddleware, getOTP]);

router.get("/getProfile", [authMiddleware, getProfile]);

router.get("/getAddress", [authMiddleware, getAddress]);


module.exports = router;
