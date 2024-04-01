const express = require("express");

const { 
    getToken, 
    getLoginOTPReq, 
    enrollByAadhar, 
    getEnrollSuggestion, 
    setPreferredAddress,
    getLoginOTPVerify,
    getEnrollOTPReq,
    getProfile,
    getCard,
    generateLinkToken,
    shareCareContext,
    updateVisitAttribute
} = require("../controller/abha.controller");

const { 
    otpSchema, 
    loginOTPSchema,
    profileSchema, 
    addressSchema, 
    preferAddressSchema,
    getAbhaNumberSchema,
    getProfileSchema,
    generateLinkTokenSchema,
    shareCareContextSchema,
    updateVisitAttributeSchema
} = require("../schema/index");

const { authMiddleware, xTokenMiddleware } = require("../middleware/auth");

const {
    validate
  } = require('../middleware/validationMiddleware')


const router = express.Router();

router.get("/getToken", getToken);

router.post("/enrollOTPReq", [authMiddleware, validate(otpSchema), getEnrollOTPReq]);

router.post("/enrollByAadhar", [authMiddleware, validate(profileSchema),  enrollByAadhar]);

router.post("/enrollSuggestion", [authMiddleware, validate(addressSchema), getEnrollSuggestion]);

router.post("/setPreferredAddress", [authMiddleware, validate(preferAddressSchema), setPreferredAddress]);

router.post("/loginOTPReq", [authMiddleware, validate(loginOTPSchema), getLoginOTPReq]);

router.post("/loginOTPVerify", [authMiddleware, validate(getAbhaNumberSchema), getLoginOTPVerify]);

router.post("/profile", [authMiddleware, xTokenMiddleware,  validate(getProfileSchema), getProfile]);

router.get("/getCard", [authMiddleware, xTokenMiddleware, getCard]);

router.post("/generate-link-token", [validate(generateLinkTokenSchema), generateLinkToken]);

router.post("/share-care-context", [validate(shareCareContextSchema), shareCareContext]);

router.post("/update-visit-attribute", [validate(updateVisitAttributeSchema), updateVisitAttribute])

module.exports = router;
