const Joi = require('joi');

const createTicketSchema = Joi.object().keys({
    title: Joi.string().required(),
    priority: Joi.string().optional().valid('high','low','medium').default('low'),
    description: Joi.string().required()
});

const getTicketSchema = Joi.object().keys({
    id: Joi.string().required()
});

module.exports = {
    createTicketSchema,
    getTicketSchema
};