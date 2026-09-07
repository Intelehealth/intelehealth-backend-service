/**
 * Typed application errors. Every handler throws one of these; the error
 * middleware turns them into the documented response shape.
 */
class AppError extends Error {
  constructor(message, status = 500, code = "INTERNAL_ERROR", details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message, code = "BAD_REQUEST", details) {
    super(message, 400, code, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Missing or invalid credentials", code = "UNAUTHORIZED") {
    super(message, 401, code);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Not allowed", code = "FORBIDDEN") {
    super(message, 403, code);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Not found", code = "NOT_FOUND") {
    super(message, 404, code);
  }
}

/**
 * 409. Used for both illegal lifecycle transitions (LLD §04) and the lost
 * claim race (LLD §09.2) — the two places the LLD insists on a clear error
 * instead of a silent overwrite or a false success.
 */
class ConflictError extends AppError {
  constructor(message, code = "CONFLICT", details) {
    super(message, 409, code, details);
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests", code = "RATE_LIMITED", details) {
    super(message, 429, code, details);
  }
}

/**
 * A human-usable description of any thrown value.
 *
 * Sequelize wraps driver failures, and an AggregateError — what a refused TCP
 * connection produces on a host resolving to both ::1 and 127.0.0.1 — has an
 * empty `message`. Logging `err.message` alone silently produces "".
 */
const describeError = (err) => {
  if (!err) return "unknown error";
  return (
    err.message ||
    err.original?.message ||
    err.parent?.message ||
    err.errors?.map((e) => [e.code || e.name, e.address, e.port].filter(Boolean).join(" ")).join("; ") ||
    err.name ||
    String(err)
  );
};

module.exports = {
  describeError,
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
};
