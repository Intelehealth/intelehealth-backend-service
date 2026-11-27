/**
 * Validate req[property] (body by default) against a Joi schema
 * @param {Joi.Schema} schema
 * @param {"body"|"query"|"params"} property
 */
exports.validate = (schema, property = "body") => (req, res, next) => {
  const {
    error
  } = schema.validate(req[property]);
  if (error) {
    res.status(422).json(
      {
        success: false,
        code: 422,
        message: error.details[0].message,
      });
  } else {
    next();
  }
};

/**
 * Ensure a multipart file was sent under the given field name
 * @param {string} fieldName
 */
exports.requireFile = (fieldName) => (req, res, next) => {
  if (req.file) return next();
  res.status(422).json(
    {
      success: false,
      code: 422,
      message: `"${fieldName}" file is required`,
    });
};
