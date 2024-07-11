const validate = (schema, property) => (req, res, next) => {
    const { error } = schema.validate(req[property]);
    const valid = error == null;
    if (valid) { next(); } 
    else {
        res.status(422).json(
            {
                success: false,
                code: 422,
                message: error.details[0].message,
            });
        return;
    }
};

module.exports = { validate };