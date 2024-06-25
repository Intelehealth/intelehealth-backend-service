const Joi = require('joi');


exports.resetPassswordParamSchema = Joi.object({
    uuid: Joi.string().guid().required()
})

exports.resetPassswordSchema = Joi.object({
    newPassword: Joi.string().required(),
    confirmNewPassword: Joi.any().equal(Joi.ref('newPassword')).required()
        .messages({
            'any.only': `"confirmNewPassword" does not match "newPassword"`,
        })
});
