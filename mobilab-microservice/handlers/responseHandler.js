const RATE_LIMIT_HEADERS = ["retry-after", "x-ratelimit-remaining"];

/**
 * Copy Mobilab's rate-limit headers onto our response
 * @param {*} res
 * @param {object} headers
 */
const forwardRateLimitHeaders = (res, headers = {}) => {
  RATE_LIMIT_HEADERS.forEach((name) => {
    if (headers?.[name] !== undefined) res.set(name, headers[name]);
  });
};

/**
 * Send the Mobilab response to the caller unchanged ({ data, meta } envelope)
 * @param {*} res
 * @param {*} apiResponse - axios response
 */
const sendResponse = (res, apiResponse) => {
  forwardRateLimitHeaders(res, apiResponse?.headers);
  if (apiResponse?.status === 204 || !apiResponse?.data) {
    return res.status(apiResponse?.status ?? 204).end();
  }
  return res.status(apiResponse.status).json(apiResponse.data);
};

module.exports = { forwardRateLimitHeaders, sendResponse };
