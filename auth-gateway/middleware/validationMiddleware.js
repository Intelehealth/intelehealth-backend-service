
exports.validateParams = (schema) => (req, res, next) => {
  const {
    error
  } = schema.validate(req.params);
  if (error) {
    res.status(422).json(
      {
        success: false,
        code: 422,
        message: error.details[0].message,
      });
    return;
  }
  next();
};


exports.validate = (schema) => (req, res, next) => {
  const {
    error
  } = schema.validate(req.body);
  if (error) {
    res.status(422).json(
      {
        success: false,
        code: 422,
        message: error.details[0].message,
      });
    return;
  }
  next();
};