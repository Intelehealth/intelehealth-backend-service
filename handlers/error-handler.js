const errorHandler = (err, req, res, next) => {
  if (err.message === "jwt expired") {
    return res
      .status(401)
      .json({ status: false, message: "Email or Phone Already Registered" });
  }

  const statusCode = err.code || 500;

  return res.status(statusCode).json({
    status: false,
    message: err.message,
  });
};

module.exports = errorHandler;
