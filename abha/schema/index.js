const Joi = require("joi");

exports.otpSchema = Joi.object()
  .keys({
    aadhar: Joi.string()
      .min(12)
      .max(12)
      .required(),
});

exports.loginOTPSchema = Joi.object()
  .keys({
    value: Joi.string().required(),
    scope: Joi.string().valid('aadhar','mobile').required()
});


exports.profileSchema = Joi.object()
  .keys({
    otp: Joi.string()
      .required(),
    mobileNo: Joi.string()
    .required(),
    txnId: Joi.string()
    .required(),
});

exports.addressSchema = Joi.object()
  .keys({
    txnId: Joi.string()
    .required(),
});

exports.preferAddressSchema = Joi.object()
  .keys({
    abhaAddress: Joi.string()
    .required(),
    txnId: Joi.string()
    .required(),
});

exports.getAbhaNumberSchema = Joi.object()
  .keys({
    otp: Joi.string()
      .required(),
    txnId: Joi.string()
    .required(),
    scope: Joi.string().valid('aadhar','mobile').required()
});

exports.getProfileSchema = Joi.object()
  .keys({
    txnId: Joi.string()
      .required(),
    abhaNumber: Joi.string()
    .required()
});

exports.postLinkCareContextSchema = Joi.object({
  abhaAddress: Joi.string().optional(),
  abhaNumber: Joi.string().optional(),
  personDisplay: Joi.string().required(),
  encounterUUID: Joi.string().required(),
  visitUUID: Joi.string().required(),
  startDateTime: Joi.string().required(),
  name: Joi.string().optional(),
  gender: Joi.string().optional(),
  yearOfBirth: Joi.number().optional(),
  mobileNumber: Joi.string().optional(),
  openMRSID: Joi.string().optional() 
});
