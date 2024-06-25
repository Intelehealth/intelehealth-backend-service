const { TokenExpiredError } = require("jsonwebtoken");

// eslint-disable-next-line
const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(err);
  }

  if (err instanceof TokenExpiredError) {
    err.code = err.status = 401;
  }

  if (err.name === "ValidationError") {
    res.status(err.code || 422).json({ success: false, message: err.message });
    return;
  }

  if (err.name === "CastError" && err.path === "_id") {
    res.status(422).json({ success: false, message: "Invalid ObjectID." });
    return;
  }

  // if(err?.response?.data?.error?.message) {
  //   err.message = err?.response?.data?.error?.message
  // }

  res.status(err.status || 500);

  return res.json({
    success: false,
    code: err.code || 422,
    message: err.message,
  });
};

module.exports = { errorHandler };
