/**
 * Error handler
 * @param {*} err - error object
 * @param {*} req - req object
 * @param {*} res - res object
 * @param {*} next - next object 
 */
const errorHandler = (err, req, res, next) => {
  if (err.message === "jwt expired") {
    return res
      .status(401)
      .json({ status: false, message: "Email or Phone Already Registered" });
  }

  const statusCode = err.code || 422;

  return res.status(statusCode).json({
    status: false,
    message: err.message,
  });
};

module.exports = errorHandler;
