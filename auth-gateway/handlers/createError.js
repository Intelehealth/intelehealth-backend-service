exports.createError = (message = 'Something went wrong!', status = 500) => {
    const error = new Error(message);
    error.status = status;
    return error;
};