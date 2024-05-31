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
  getAllAppointments,
  getSlots,
  getSpecialitySlots,
  startAppointment,
  releaseAppointment,
  getBookedAppointments,
  getRescheduledAppointments,
  getRescheduledAppointmentsOfVisit,
  getCancelledAppointments,
  getScheduledMonths,
  updateDaysOffSchedule
} = require("../services/appointment.service");

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
      // { key: "slotDays", type: "string" },
      { key: "slotSchedule", type: "object" },
      { key: "speciality", type: "string" },
      { key: "type", type: "string" },
      { key: "month", type: "string" },
      { key: "year", type: "string" },
      { key: "startDate", type: "string" },
      { key: "endDate", type: "string" }
    ];
    try {
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await upsertAppointmentSchedule(req.body);
        res.json({
          ...data,
          status: true,
        });
      }
    } catch (error) {
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
      const data = await getUserAppointmentSchedule({ where });
      res.json({
        status: true,
        data,
      });
    } catch (error) {
      console.log("error: ", error);
      next(error);
    }
  };

  this.getScheduledMonths = async (req, res, next) => {
    try {
      const userUuid = req.params.userUuid;
      const year = req.query.year;
      console.log("userUuid, year", userUuid, year);
      const data = await getScheduledMonths({ userUuid, year });
      res.json({
        status: true,
        data,
      });
    } catch (error) {
      console.log("error: ", error);
      next(error);
    }
  };

  this.getUserSlots = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: "fromDate", type: "string" },
        { key: "toDate", type: "string" },
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const userUuid = req.params.userUuid;
        const data = await getUserSlots({ ...req.query, userUuid });
        res.json({
          status: true,
          data,
        });
      }
    } catch (error) {
      console.log("error: ", error);
      next(error);
    }
  };

  this.getSpecialitySlots = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: "fromDate", type: "string" },
        { key: "toDate", type: "string" },
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const speciality = req.params.speciality;
        const data = await getSpecialitySlots({ ...req.query, speciality });
        res.json({
          status: true,
          data,
        });
      }
    } catch (error) {
      console.log("error: ", error);
      next(error);
    }
  };

  this.getSlots = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: "fromDate", type: "string" },
        { key: "toDate", type: "string" },
        { key: "locationUuid", type: "string" },
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const data = await getSlots(req.query);
        const cancelledAppointments = await getCancelledAppointments(req.query);
        res.json({
          status: true,
          data,
          cancelledAppointments,
        });
      }
    } catch (error) {
      console.log("error: ", error);
      next(error);
    }
  };

  this.getAppointmentSlots = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: "fromDate", type: "string" },
        { key: "toDate", type: "string" },
        { key: "speciality", type: "string" },
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const data = await _getAppointmentSlots(req.query);
        const bookedAppointments = await getBookedAppointments(req.query);
        const rescheduledAppointments = await getRescheduledAppointments(
          req.query
        );
        res.json({
          status: true,
          ...data,
          bookedAppointments,
          rescheduledAppointments,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  this.bookAppointment = async (req, res, next) => {
    try {
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
        res.json({
          status: true,
          ...data,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  this.rescheduleAppointment = async (req, res, next) => {
    try {
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
        { key: "appointmentId", type: "number" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await _rescheduleAppointment(req.body);
        res.json({
          status: true,
          ...data,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  this.cancelAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: "id", type: "number" },
        { key: "visitUuid", type: "string" },
        // { key: "reason", type: "string" },
        { key: "hwUUID", type: "string" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await _cancelAppointment(req.body);
        res.json(data);
      }
    } catch (error) {
      next(error);
    }
  };
  
  this.completeAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [{ key: "visitUuid", type: "string" }];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await _completeAppointment(req.body);
        res.json(data);
      }
    } catch (error) {
      next(error);
    }
  };

  this.getAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [{ key: "visitUuid", type: "string" }];
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getAppointment(req.params);
        const rescheduledAppointments = await getRescheduledAppointmentsOfVisit(
          req.params
        );
        res.json({ 
          status: true, 
          data, 
          rescheduledAppointments, 
        });
      }
    } catch (error) {
      next(error);
    }
  };

  this.startAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: "appointmentId", type: "number" },
        { key: "drName", type: "string" },
        { key: "userUuid", type: "string" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await startAppointment(req.body);
        res.json({ status: true, data });
      }
    } catch (error) {
      next(error);
    }
  };

  this.releaseAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [{ key: "visitUuid", type: "string" }];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await releaseAppointment(req.body);
        res.json({ status: true, data });
      }
    } catch (error) {
      next(error);
    }
  };

  this.updateDaysOff = async (req, res, next) => {
    const keysAndTypeToCheck = [
      { key: "userUuid", type: "string" },
      { key: "daysOff", type: "object" },
      { key: "month", type: "object" },
      { key: "year", type: "object" },
    ];
    try {
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await updateDaysOffSchedule(req.body);
        res.json({
          ...data,
          status: true,
        });
      }
    } catch (error) {
      console.log("error: ", error);
      next(error);
    }
  };

  this.getAllAppointments = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [{ key: "visitUuid", type: "string" }];
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getAllAppointments(req.params);
        res.json({ status: true, data });
      }
    } catch (error) {
      next(error);
    }
  };

  this.appointmentPush = async (req, res, next) => {
    try {
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
        await _bookAppointment(req.body);

        res.json({
          status: true,
          message: "appointment push successfully!",
        });
      }
    } catch (error) {
      next(error);
    }
  };

  return this;
})();
