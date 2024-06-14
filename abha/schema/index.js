const Joi = require("joi");

exports.otpSchema = Joi.object()
  .keys({
    scope: Joi.optional().valid('aadhar', 'mobile'),
    txnId: Joi.optional(),
    value: Joi.when("scope", {
      is: 'mobile', then: Joi.string().min(10)
        .max(10)
        .required(), otherwise: Joi.string().min(12)
          .max(12)
          .required()
    })
  });

exports.loginOTPSchema = Joi.object()
  .keys({
    value: Joi.string().required(),
    scope: Joi.string().valid('aadhar', 'mobile', 'abha-number', 'abha-address').required(),
    authMethod: Joi.optional()
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

exports.enrollByAbdmSchema = Joi.object()
  .keys({
    otp: Joi.string()
      .required(),
    mobileNo: Joi.optional(),
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
    scope: Joi.string().valid('aadhar', 'mobile', 'abha-number', 'abha-address').required(),
    authMethod: Joi.optional()
  });

exports.getProfileSchema = Joi.object()
  .keys({
    scope: Joi.optional(),
    txnId: Joi.any().when('scope', { is: 'abha-address', then: Joi.optional(), otherwise: Joi.string().required() }),
    abhaNumber: Joi.any().when('scope', { is: 'abha-address', then: Joi.optional(), otherwise: Joi.string().required() })
  });

exports.postLinkCareContextSchema = Joi.object({
  abhaAddress: Joi.optional(),
  abhaNumber: Joi.optional(),
  personDisplay: Joi.optional(),
  encounterUUID: Joi.optional(),
  visitUUID: Joi.string().required(),
  startDateTime: Joi.string().required(),
  name: Joi.optional(),
  gender: Joi.optional(),
  yearOfBirth: Joi.optional(),
  mobileNumber: Joi.optional(),
  openMRSID: Joi.optional()
});
