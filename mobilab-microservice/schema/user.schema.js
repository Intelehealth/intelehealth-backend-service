const Joi = require("joi");
const { phoneNumber, numericId, pagination } = require("./common.schema");
const { PAGE_LIMITS, ROLE_CATEGORIES, USER_SORT_BY } = require("../constants/mobilab.constants");

exports.getRolesSchema = Joi.object().keys(pagination(PAGE_LIMITS.ROLES));

exports.getUsersSchema = Joi.object()
  .keys({
    ...pagination(PAGE_LIMITS.USERS),
    search: Joi.string().trim().optional(),
    clinic_id: numericId.optional(),
    role_slug: Joi.string().pattern(/^[a-z0-9-]+$/).optional(),
    category: Joi.string().valid(...ROLE_CATEGORIES).optional(),
    sort_by: Joi.string().valid(...USER_SORT_BY).optional()
  });

exports.userIdSchema = Joi.object()
  .keys({
    id: numericId.required()
  });

exports.createUserSchema = Joi.object()
  .keys({
    full_name: Joi.string().trim().required(),
    email: Joi.string().email().optional(),
    phone_number: phoneNumber.optional(),
    password: Joi.string().min(8).optional(),
    role_id: numericId.optional(),
    // numeric clinic ID or clinic_code
    clinic_ids: Joi.array().items(
      Joi.alternatives().try(numericId, Joi.string().trim())
    ).min(1).required()
  }).or("email", "phone_number");

exports.updateUserSchema = Joi.object()
  .keys({
    full_name: Joi.string().trim().optional(),
    email: Joi.string().email().optional(),
    phone_number: phoneNumber.optional(),
    role_id: numericId.allow(null).optional()
  }).min(1);
