const handleValidation = (err) => {
  const keys = err?.errors?.[0]?.path?.split(".");
  const msg = err?.errors?.[0]?.message;
  if (keys.length > 1 && msg.includes("must be unique")) {
    return `This ${keys[1]} already exist, ${keys[1]} must be unique`;
  } else {
    return msg;
  }
};

const errorHandler = (err, req, res, next) => {
  if (err.message === "jwt expired") {
    return res
      .status(401)
      .json({ status: false, message: "Email or Phone Already Registered" });
  }

  let statusCode = err.code || 422;
  let message = err.message;

  if (err?.message === "Validation error") {
    message = handleValidation(err);
  }

  return res.status(statusCode).json({
    status: false,
    message,
  });
};

module.exports = errorHandler;
