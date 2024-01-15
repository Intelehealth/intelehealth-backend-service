const express = require("express");

const { 
    getToken, 
    getLoginOTPReq, 
    enrollByAadhar, 
    getEnrollSuggestion, 
    setPreferredAddress,
    getLoginOTPVerify,
    getEnrollOTPReq,
    getProfile
} = require("../controller/abha.controller");

const { 
    otpSchema, 
    loginOTPSchema,
    profileSchema, 
    addressSchema, 
    preferAddressSchema,
    getAbhaNumberSchema 
} = require("../schema/index");

const { authMiddleware, xTokenMiddleware } = require("../middleware/auth");

const {
    validate
  } = require('../middleware/validationMiddleware')


const router = express.Router();

router.get("/getToken", getToken);

router.get("/getEnrollOTPReq", [authMiddleware, validate(otpSchema), getEnrollOTPReq]);

router.post("/enrollByAadhar", [authMiddleware, validate(profileSchema),  enrollByAadhar]);

router.get("/getEnrollSuggestion", [authMiddleware, validate(addressSchema), getEnrollSuggestion]);

router.post("/setPreferredAddress", [authMiddleware, validate(preferAddressSchema), setPreferredAddress]);

router.get("/getLoginOTPReq", [authMiddleware, validate(loginOTPSchema), getLoginOTPReq]);

router.get("/getLoginOTPVerify", [authMiddleware, validate(getAbhaNumberSchema), getLoginOTPVerify]);

router.get("/getProfile", [authMiddleware, xTokenMiddleware, getProfile]);


module.exports = router;
