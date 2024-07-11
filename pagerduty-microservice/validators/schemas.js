const Joi = require('joi');

const createTicketSchema = Joi.object().keys({
    title: Joi.string().required(),
    priority: Joi.string().optional().valid('high','low','medium').default('low'),
    description: Joi.string().required()
});

const getTicketSchema = Joi.object().keys({
    id: Joi.string().required()
});

const getTicketsSchema = Joi.object().keys({
    page: Joi.number().required().min(1),
    size: Joi.number().required().valid(5,10,50,100)
});

module.exports = {
    createTicketSchema,
    getTicketSchema,
    getTicketsSchema
};