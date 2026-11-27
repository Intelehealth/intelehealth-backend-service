const multer = require("multer");
const { logStream } = require("../logger");
const { forwardRateLimitHeaders } = require("./responseHandler");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {

  // Mobilab answered with an error: keep its status and { error: { code, message } }
  if (err?.isAxiosError && err?.response) {
    // A 401 from Mobilab means OUR mlab_ key is bad/revoked - a server config
    // problem, not the caller's session, so don't send 401 (it logs users out)
    const status = err.response.status === 401 ? 502 : err.response.status;
    forwardRateLimitHeaders(res, err.response.headers);
    return res.status(status).json({
      success: false,
      code: status,
      error_code: err?.response?.data?.error?.code ?? null,
      message: err?.response?.data?.error?.message
        ?? err?.response?.data?.detail
        ?? err.message
    });
  }

  // Mobilab could not be reached
  if (err?.isAxiosError) {
    return res.status(502).json({
      success: false,
      code: 502,
      error_code: "mobilab_unavailable",
      message: "Mobilab service is unreachable, please try again later"
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(422).json({
      success: false,
      code: 422,
      message: err.message
    });
  }

  const status = err.status ?? 500;
  if (status >= 500) logStream("error", `${req.method} ${req.originalUrl}---${err.stack ?? err.message}`);

  return res.status(status).json({
    success: false,
    code: status,
    message: err.message
  });
};

module.exports = { errorHandler };
