const Joi = require("joi");
const { phoneNumber, isoDate, numericId, pagination } = require("./common.schema");
const {
  PAGE_LIMITS,
  BOOKING_STATUS,
  GENDERS,
  READING_ACTIONS
} = require("../constants/mobilab.constants");

const codeList = Joi.array().items(Joi.string().trim()).unique();

const vitals = {
  sys: Joi.number().positive().optional(),
  dia: Joi.number().positive().optional(),
  height: Joi.number().positive().optional(),
  weight: Joi.number().positive().optional(),
  spo2: Joi.number().min(0).max(100).optional(),
  questionaires: Joi.object().unknown(true).allow(null).optional()
};

exports.getBookingsSchema = Joi.object()
  .keys({
    ...pagination(PAGE_LIMITS.BOOKINGS),
    status: Joi.string().valid(...BOOKING_STATUS).optional(),
    start_date: isoDate.optional(),
    end_date: isoDate.optional()
  });

exports.bookingIdSchema = Joi.object()
  .keys({
    booking_id: Joi.string().trim().required()
  });

exports.createBookingSchema = Joi.object()
  .keys({
    booking_id: Joi.string().trim().required(),
    patient_name: Joi.string().trim().required(),
    patient_phone: phoneNumber.required(),
    selected_tests: Joi.object().keys({
      test_codes: codeList.optional(),
      profile_codes: codeList.optional(),
      package_codes: codeList.optional()
    }).optional(),
    dob: isoDate.required(),
    gender: Joi.string().valid(...GENDERS).required(),
    clinic_id: numericId.optional(),
    // null / omitted = auto-assign every active phlebotomist of the clinic
    assigned_to: numericId.allow(null).optional(),
    ...vitals,
    is_dummy: Joi.boolean().optional()
  });

// status is platform-driven and cannot be updated
exports.updateBookingSchema = Joi.object()
  .keys({
    clinic_id: numericId.optional(),
    assigned_to: numericId.allow(null).optional(),
    ...vitals
  }).min(1);

exports.readingIdSchema = Joi.object()
  .keys({
    booking_id: Joi.string().trim().required(),
    id: numericId.required()
  });

exports.updateReadingSchema = Joi.object()
  .keys({
    action: Joi.string().valid(...READING_ACTIONS).required(),
    remarks: Joi.string().max(500).optional()
  });
