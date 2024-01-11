const Joi = require("joi");

exports.otpSchema = Joi.object()
  .keys({
    aadhar: Joi.string()
      .min(12)
      .max(12)
      .required(),
});

exports.mobileSchema = Joi.object()
  .keys({
    mobile: Joi.string()
      .min(10)
      .max(10)
      .required(),
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
});