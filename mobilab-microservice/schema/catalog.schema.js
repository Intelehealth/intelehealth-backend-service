const Joi = require("joi");
const { pagination } = require("./common.schema");
const { PAGE_LIMITS } = require("../constants/mobilab.constants");

exports.getLabTestsSchema = Joi.object().keys(pagination(PAGE_LIMITS.CATALOG));

exports.getLabProfilesSchema = Joi.object().keys(pagination(PAGE_LIMITS.CATALOG));
