const Joi = require("joi");

// Phone numbers are sent without a leading +, e.g. 919876543210
exports.phoneNumber = Joi.string().pattern(/^[1-9]\d{6,14}$/).messages({
  "string.pattern.base": "{{#label}} must be digits only with country code and no leading +, e.g. 919876543210"
});

// YYYY-MM-DD
exports.isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({
  "string.pattern.base": "{{#label}} must be in YYYY-MM-DD format"
});

exports.numericId = Joi.number().integer().positive();

exports.pagination = (maxLimit) => ({
  limit: Joi.number().integer().min(1).max(maxLimit).optional(),
  offset: Joi.number().integer().min(0).optional()
});
