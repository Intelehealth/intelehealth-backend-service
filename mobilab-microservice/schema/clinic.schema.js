const Joi = require("joi");
const { phoneNumber, numericId, pagination } = require("./common.schema");
const {
  PAGE_LIMITS,
  CLINIC_STATUS,
  CLINIC_SORT_BY,
  CLINIC_FILE_TYPES
} = require("../constants/mobilab.constants");

exports.getClinicsSchema = Joi.object()
  .keys({
    ...pagination(PAGE_LIMITS.CLINICS),
    search: Joi.string().trim().optional(),
    status: Joi.string().valid(...CLINIC_STATUS).optional(),
    sort_by: Joi.string().valid(...CLINIC_SORT_BY).optional()
  });

exports.clinicIdSchema = Joi.object()
  .keys({
    id: numericId.required()
  });

exports.createClinicSchema = Joi.object()
  .keys({
    name: Joi.string().trim().required(),
    owner: Joi.object().keys({
      name: Joi.string().trim().required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      role_id: numericId.required(),
      phone_number: phoneNumber.optional()
    }).allow(null).optional(),
    city: Joi.string().trim().required(),
    state: Joi.string().trim().required(),
    country: Joi.string().trim().required(),
    zip_code: Joi.string().trim().required(),
    clinic_code: Joi.string().trim().optional(),
    license_s3_key: Joi.string().optional(),
    license_number: Joi.string().optional(),
    phone_number: phoneNumber.optional(),
    email: Joi.string().email().optional(),
    street_address: Joi.string().optional(),
    gst_number: Joi.string().optional(),
    gst_s3_key: Joi.string().optional(),
    logo_s3_key: Joi.string().optional()
  });

exports.updateClinicSchema = Joi.object()
  .keys({
    name: Joi.string().trim().optional(),
    phone_number: phoneNumber.optional(),
    email: Joi.string().email().optional(),
    street_address: Joi.string().optional(),
    city: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    country: Joi.string().trim().optional(),
    zip_code: Joi.string().trim().optional(),
    license_number: Joi.string().optional(),
    gst_number: Joi.string().optional(),
    logo_s3_key: Joi.string().optional(),
    status: Joi.string().valid(...CLINIC_STATUS).optional()
  }).min(1);

// multipart fields other than file_obj
exports.uploadClinicFileSchema = Joi.object()
  .keys({
    type: Joi.string().valid(...CLINIC_FILE_TYPES).required(),
    content_type: Joi.string().pattern(/^[\w.+-]+\/[\w.+-]+$/).optional()
  });
