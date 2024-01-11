var express = require("express");

const { 
    getToken, 
    getOTPByMobile, 
    enrollByAadhar, 
    getEnrollSuggestion, 
    setPreferredAddress,
    getDetails,
    getOTPByAadhar
} = require("../controller/abha.controller");

const { 
    otpSchema, 
    mobileSchema,
    profileSchema, 
    addressSchema, 
    preferAddressSchema,
    getAbhaNumberSchema 
} = require("../schema/index");

const authMiddleware = require("../middleware/auth");

const {
    validate
  } = require('../middleware/validationMiddleware')


const router = express.Router();

router.get("/getToken", getToken);

router.get("/getOTPByAadhar", [authMiddleware, validate(otpSchema), getOTPByAadhar]);

router.post("/enrollByAadhar", [authMiddleware, validate(profileSchema),  enrollByAadhar]);

router.get("/getEnrollSuggestion", [authMiddleware, validate(addressSchema), getEnrollSuggestion]);

router.post("/setPreferredAddress", [authMiddleware, validate(preferAddressSchema), setPreferredAddress]);

router.get("/getOTPByMobile", [authMiddleware, validate(mobileSchema), getOTPByMobile]);

router.get("/getDetails", [authMiddleware, validate(getAbhaNumberSchema), getDetails]);


module.exports = router;
