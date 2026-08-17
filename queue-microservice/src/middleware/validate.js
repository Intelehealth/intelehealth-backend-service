const { BadRequestError } = require("../utils/errors");

/**
 * Tiny declarative body/param validator. Dependency-free on purpose — the
 * shapes here are small and the service has no validation library installed.
 *
 * Schema entry: { type, required, enum, min, max, maxLength, default }
 * type: "string" | "number" | "integer" | "boolean" | "object" | "uuidish"
 */
const coerce = (value, rule) => {
  if (value === undefined || value === null || value === "") return undefined;
  switch (rule.type) {
    case "number":
    case "integer": {
      const n = Number(value);
      return Number.isFinite(n) ? n : NaN;
    }
    case "boolean":
      if (typeof value === "boolean") return value;
      if (value === "true" || value === 1 || value === "1") return true;
      if (value === "false" || value === 0 || value === "0") return false;
      return NaN;
    case "string":
    case "uuidish":
      return String(value).trim();
    default:
      return value;
  }
};

const validateObject = (input, schema, label) => {
  const errors = [];
  const output = {};

  for (const [field, rule] of Object.entries(schema)) {
    let value = coerce(input?.[field], rule);

    if (value === undefined) {
      if (rule.default !== undefined) {
        output[field] = typeof rule.default === "function" ? rule.default() : rule.default;
        continue;
      }
      if (rule.required) errors.push(`${field} is required`);
      continue;
    }

    if (Number.isNaN(value)) {
      errors.push(`${field} must be a ${rule.type}`);
      continue;
    }
    if (rule.type === "integer" && !Number.isInteger(value)) {
      errors.push(`${field} must be an integer`);
      continue;
    }
    if (rule.type === "object" && (typeof value !== "object" || Array.isArray(value))) {
      errors.push(`${field} must be an object`);
      continue;
    }
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rule.enum.join(", ")}`);
      continue;
    }
    if (rule.maxLength && String(value).length > rule.maxLength) {
      errors.push(`${field} must be at most ${rule.maxLength} characters`);
      continue;
    }
    if (rule.min !== undefined && value < rule.min) {
      errors.push(`${field} must be >= ${rule.min}`);
      continue;
    }
    if (rule.max !== undefined && value > rule.max) {
      errors.push(`${field} must be <= ${rule.max}`);
      continue;
    }

    output[field] = value;
  }

  if (errors.length) {
    throw new BadRequestError(`Invalid ${label}`, "VALIDATION_ERROR", { errors });
  }
  return output;
};

const validateBody = (schema) => (req, _res, next) => {
  try {
    req.validated = { ...(req.validated || {}), ...validateObject(req.body, schema, "request body") };
    next();
  } catch (err) {
    next(err);
  }
};

const validateQuery = (schema) => (req, _res, next) => {
  try {
    req.validatedQuery = validateObject(req.query, schema, "query string");
    next();
  } catch (err) {
    next(err);
  }
};

const validateParams = (schema) => (req, _res, next) => {
  try {
    req.validatedParams = validateObject(req.params, schema, "path parameters");
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { validateBody, validateQuery, validateParams, validateObject };
