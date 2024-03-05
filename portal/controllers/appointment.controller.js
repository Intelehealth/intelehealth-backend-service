const { validateParams } = require("../handlers/helper");
const {
  getUserAppointmentSchedule,
  upsertAppointmentSchedule,
  _getAppointmentSlots,
  _bookAppointment,
  _rescheduleAppointment,
  getUserSlots,
  _cancelAppointment,
  getAppointment,
  getSlots,
} = require("../services/appointment.service");
const { logStream } = require("../logger/index");

module.exports = (function () {
  /**
   * Update a schedule if aalready exist otherwise create a new w.r.t. userUuid
   * @param {*} req
   * @param {*} res
   */
  this.upsertSchedule = async (req, res, next) => {
    const keysAndTypeToCheck = [
      { key: "userUuid", type: "string" },
      { key: "drName", type: "string" },
      { key: "slotDays", type: "string" },
      { key: "slotSchedule", type: "object" },
      { key: "speciality", type: "string" },
      { key: "type", type: "string" },
      { key: "month", type: "string" },
      { key: "year", type: "string" },
    ];
    try {
      logStream('debug','API calling', 'Upsert Schedule');
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await upsertAppointmentSchedule(req.body);
        logStream('debug','Upserted Schedule', 'Upsert Schedule');
        res.json({
          ...data,
          status: true,
        });
      }
    } catch (error) {
      logStream("error", error.message);
      console.log("error: ", error);
      next(error);
    }
  };

  this.getAppointmentSchedule = async (req, res, next) => {
    try {
      const userUuid = req.params.userUuid;
      const year = req.query.year;
      const month = req.query.month;
      let where = { userUuid };
      if (year) where.year = year;
      if (month) where.month = month;
      logStream('debug','API calling', 'Get Appointment Schedule');
      const data = await getUserAppointmentSchedule({ where });
      logStream('debug','Got Appointment Schedule', 'Get Appointment Schedule');
      res.json({
        status: true,
        data,
      });
    } catch (error) {
      logStream("error", error.message);
      console.log("error: ", error);
      next(error);
    }
  };

  this.getUserSlots = async (req, res, next) => {
    try {
      logStream('debug','API calling', 'Get User Slots');
      const keysAndTypeToCheck = [
        { key: "fromDate", type: "string" },
        { key: "toDate", type: "string" },
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const userUuid = req.params.userUuid;
        const data = await getUserSlots({ ...req.query, userUuid });
        logStream('debug','Got User Slots', 'Get User Slots');
        res.json({
          status: true,
          data,
        });
      }
    } catch (error) {
      logStream("error", error.message);
      console.log("error: ", error);
      next(error);
    }
  };
  this.getSlots = async (req, res, next) => {
    try {
      logStream('debug','API calling', 'Get Slots');
      const keysAndTypeToCheck = [
        { key: "fromDate", type: "string" },
        { key: "toDate", type: "string" },
        { key: "locationUuid", type: "string" },
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const data = await getSlots(req.query);
        logStream('debug','Got Slots', 'Get Slots');
        res.json({
          status: true,
          data,
        });
      }
    } catch (error) {
      logStream('error', error.message);
      console.log("error: ", error);
      next(error);
    }
  };

  this.getAppointmentSlots = async (req, res, next) => {
    try {
      logStream('debug','API calling', 'Get Appointment Slots');
      const keysAndTypeToCheck = [
        { key: "fromDate", type: "string" },
        { key: "toDate", type: "string" },
        { key: "speciality", type: "string" },
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const data = await _getAppointmentSlots(req.query);
        logStream('debug','Got Appointment Slots', 'Get Appointment Slots');
        res.json({
          status: true,
          ...data,
        });
      }
    } catch (error) {
      logStream('error', error.message);
      next(error);
    }
  };

  this.bookAppointment = async (req, res, next) => {
    try {
      logStream('debug','API calling', 'Book Appointment');
      const keysAndTypeToCheck = [
        { key: "slotDay", type: "string" },
        { key: "slotDuration", type: "number" },
        { key: "slotDurationUnit", type: "string" },
        { key: "slotTime", type: "string" },
        { key: "speciality", type: "string" },
        { key: "userUuid", type: "string" },
        { key: "drName", type: "string" },
        { key: "visitUuid", type: "string" },
        { key: "locationUuid", type: "string" },
        { key: "patientName", type: "string" },
        { key: "openMrsId", type: "string" },
        { key: "hwUUID", type: "string" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await _bookAppointment(req.body);
        logStream('debug','Appointment booked', 'Book Appointment');
        res.json({
          status: true,
          ...data,
        });
      }
    } catch (error) {
      logStream('error', error.message);
      next(error);
    }
  };

  this.rescheduleAppointment = async (req, res, next) => {
    try {
      logStream('debug','API calling', 'Reschedule Appointment');
      const keysAndTypeToCheck = [
        { key: "slotDay", type: "string" },
        { key: "slotDuration", type: "number" },
        { key: "slotDurationUnit", type: "string" },
        { key: "slotTime", type: "string" },
        { key: "speciality", type: "string" },
        { key: "userUuid", type: "string" },
        { key: "drName", type: "string" },
        { key: "visitUuid", type: "string" },
        { key: "locationUuid", type: "string" },
        { key: "patientName", type: "string" },
        { key: "openMrsId", type: "string" },
        { key: "hwUUID", type: "string" },
        { key: "reason", type: "string" },
        { key: "appointmentId", type: "number" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await _rescheduleAppointment(req.body);
        logStream('debug','Appointment Rescheduled', 'Reschedule Appointment');
        res.json({
          status: true,
          ...data,
        });
      }
    } catch (error) {
      logStream('error', error.message);
      next(error);
    }
  };

  this.cancelAppointment = async (req, res, next) => {
    try {
      logStream('debug','API calling', 'Cancel Appointment');
      const keysAndTypeToCheck = [
        { key: "id", type: "number" },
        { key: "visitUuid", type: "string" },
        { key: "reason", type: "string" },
        { key: "hwUUID", type: "string" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await _cancelAppointment(req.body);
        logStream('debug','Appointment Cancelled', 'Cancel Appointment');
        res.json(data);
      }
    } catch (error) {
      logStream('error', error.message);
      next(error);
    }
  };

  this.getAppointment = async (req, res, next) => {
    try {
      logStream('debug','API calling', 'Get Appointment');
      const keysAndTypeToCheck = [{ key: "visitUuid", type: "string" }];
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getAppointment(req.params);
        logStream('debug','Got Appointments', 'Get Appointment');
        res.json({ status: true, data });
      }
    } catch (error) {
      logStream('error', error.message);
      next(error);
    }
  };

  return this;
})();