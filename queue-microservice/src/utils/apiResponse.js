/**
 * One response envelope for every endpoint, so the Android and Web clients
 * parse a single shape (LLD §13.6 — the three-documents-drifting problem).
 */
const success = (res, data, status = 200, message = "success") =>
  res.status(status).json({ success: true, message, data });

const failure = (res, { status = 500, code = "INTERNAL_ERROR", message, details }) => {
  const body = { success: false, code, message };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
};

/** Wraps an async handler so rejections reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { success, failure, asyncHandler };
