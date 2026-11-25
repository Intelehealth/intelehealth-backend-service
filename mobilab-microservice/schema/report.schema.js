const Joi = require("joi");

exports.reportBookingIdSchema = Joi.object()
  .keys({
    booking_id: Joi.string().trim().required()
  });
