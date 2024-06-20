// eslint-disable-next-line
const errorHandler = (err, req, res, next) => {

  if (process.env.NODE_ENV !== "production") {
    console.log(err);
  }

  res.status(err?.response?.status ?? err.status ?? 500);

  return res.json({
    success: false,
    code: err.code ?? err?.response?.status ?? 422,
    message: err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err.message,
  });
};

module.exports = { errorHandler };
