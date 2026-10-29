const Joi = require("joi");
const { SCOPES, KEY_MODES } = require("../constants/mobilab.constants");

exports.ihLoginSchema = Joi.object()
  .keys({
    username: Joi.string().trim().required(),
    password: Joi.string().required()
  });

// client_id, client_secret and schema_name are added server-side from .env
exports.issueTokenSchema = Joi.object()
  .keys({
    name: Joi.string().trim().required(),
    scopes: Joi.array().items(Joi.string().valid(...SCOPES)).unique().min(1).optional(),
    rate_limit_per_hour: Joi.number().integer().min(1).max(10000).optional(),
    expires_at: Joi.date().iso().greater("now").optional(),
    mode: Joi.string().valid(...KEY_MODES).optional()
  });

// Revokes the key sent here, or MOBILAB_API_KEY when omitted.
// Live and test-mode keys are both mlab_ + 64 hex chars
exports.revokeTokenSchema = Joi.object()
  .keys({
    api_key: Joi.string().pattern(/^mlab_[0-9a-f]{64}$/).optional().messages({
      "string.pattern.base": "\"api_key\" must be a valid mlab_ key"
    })
  });
