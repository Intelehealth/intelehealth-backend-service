const logger = require("../utils/logger");
const { AppError, NotFoundError } = require("../utils/errors");
const { failure } = require("../utils/apiResponse");

const notFound = (req, _res, next) =>
  next(new NotFoundError(`No route for ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error(err.message, { code: err.code, path: req.originalUrl });
    else logger.debug(err.message, { code: err.code, path: req.originalUrl });
    return failure(res, {
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  // Sequelize unique violation on visit_uuid — treat as a conflict, not a 500.
  if (err?.name === "SequelizeUniqueConstraintError") {
    return failure(res, {
      status: 409,
      code: "DUPLICATE_ENTRY",
      message: "A queue entry already exists for this visit",
    });
  }

  logger.error("Unhandled error", { error: err?.message, path: req.originalUrl });
  return failure(res, {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Something went wrong",
  });
};

module.exports = { notFound, errorHandler };
