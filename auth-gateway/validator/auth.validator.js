const Joi = require('joi');

exports.loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
    rememberme: Joi.optional()
})

exports.getUserParamSchema = Joi.object({
    user_uuid: Joi.string().guid().required()
})

exports.deleteUserParamSchema = Joi.object({
    uuid: Joi.string().guid().required()
})

exports.validateUserSchema = Joi.object({
    username: Joi.string().required().min(3)
})

// Create User Schema
exports.createUserSchema = Joi.object({
    givenName: Joi.string().required(),
    familyName: Joi.string().required(),
    middleName: Joi.string().optional().allow(null, ''),
    gender: Joi.optional().valid('M', 'F', 'U'),
    birthdate: Joi.optional(),
    username: Joi.string().required().min(3),
    password: Joi.string().required(),
    role: Joi.required().valid('nurse', 'doctor', 'mcc'),
    addresses: Joi.array().items({
        address1: Joi.string().optional(),
        cityVillage: Joi.string().optional(),
        country: Joi.string().optional(),
        postalCode: Joi.string().optional()
    }).optional(),
    identifier: Joi.string().optional(),
    emailId: Joi.string().email().required(),
    phoneNumber: Joi.number().required(),
    countryCode: Joi.string().required()
})

// Update User Schema
exports.updateUserParamSchema = Joi.object({
    uuid: Joi.string().guid().required()
})

exports.updateUserSchema = Joi.object({
    givenName: Joi.string().required(),
    familyName: Joi.string().required(),
    gender: Joi.optional().valid('M', 'F', 'U'),
    birthdate: Joi.optional(),
    username: Joi.string().required().min(3),
    password: Joi.string().required(),
    role: Joi.required().valid('nurse', 'doctor', 'mcc'),
    addresses: Joi.array().items({
        address1: Joi.string().optional(),
        cityVillage: Joi.string().optional(),
        country: Joi.string().optional(),
        postalCode: Joi.string().optional()
    }).required().min(1),
    identifier: Joi.string().optional(),
    email: Joi.string().email().optional(),
})

// Reset User password schema
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


exports.getProviderParamSchema = Joi.object({
    user_uuid: Joi.string().guid().required()
})
