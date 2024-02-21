const Constant = require("../constants/constant");
const { MESSAGE } = require("../constants/messages");
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
  getSpecialitySlots,
  startAppointment,
  releaseAppointment,
  getBookedAppointments,
  getRescheduledAppointments,
  getRescheduledAppointmentsOfVisit,
  getCancelledAppointments,
  getScheduledMonths,
  updateDaysOffSchedule,
  _completeAppointment,
  checkAppointment,
  updateSlotSpeciality,
  validateDayOff
} = require("../services/appointment.service");

module.exports = (function () {
  /**
   * Update a schedule if aalready exist otherwise create a new w.r.t. userUuid
   * @param {*} req
   * @param {*} res
   */
  this.upsertSchedule = async (req, res, next) => {
    const keysAndTypeToCheck = [
      { key: Constant.USER_UUID, type: "string" },
      { key: Constant.DR_NAME, type: "string" },
      { key: Constant.SLOT_SCHEDULE, type: "object" },
      { key: Constant.SPECIALITY, type: "string" },
      { key: Constant.TYPE, type: "string" },
      { key: Constant.MONTH, type: "string" },
      { key: Constant.YEAR, type: "string" },
      { key: Constant.START_DATE, type: "string" },
      { key: Constant.END_DATE, type: "string" },
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
      next(error);
    }
  };

  /**
   * Get scheduled appointments based on year, month and user unique id.
   * @param {*} req
   * @param {*} res
   */
  this.getAppointmentSchedule = async (req, res, next) => {
    try {
      const { userUuid } = req.params;
      const { year, month } = req.query;
      const where = { userUuid };
      if (year) where.year = year;
      if (month) where.month = month;
      const data = await getUserAppointmentSchedule({ where });
      res.json({
        status: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get scheduled months based on years and unique user id.
   * @param {*} req
   * @param {*} res
   */
  this.getScheduledMonths = async (req, res, next) => {
    try {
      const { userUuid } = req.params;
      const { year } = req.query;
      const data = await getScheduledMonths({ userUuid, year });
      res.json({
        status: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get users slots between durations.
   * @param {*} req
   * @param {*} res
   */
  this.getUserSlots = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.FROM_DATE, type: "string" },
        { key: Constant.TO_DATE, type: "string" },
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const { userUuid } = req.params;
        const data = await getUserSlots({ ...req.query, userUuid });
        res.json({
          status: true,
          data,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Function for checking the current appointments between the timeline.
   * @param {*} req
   * @param {*} res
   * @returns Appointments
   */
  this.checkAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.FROM_DATE, type: "string" },
        { key: Constant.TO_DATE, type: "string" },
        { key: Constant.SPECIALITY, type: "string" }
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const { userUuid } = req.params;
        const data = await checkAppointment({ ...req.query, userUuid });
        res.json({
          status: true,
          data
        });
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update speciality for slots.
   * @param {*} req
   * @param {*} res
   * @returns Updated speciality slots data
   */
  this.updateSlotSpeciality = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.SPECIALITY, type: "string" }
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const { userUuid } = req.params;
        const data = await updateSlotSpeciality({ ...req.query, userUuid });
        res.json({
          status: true,
          data
        });
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get speciality slots between specified timeline.
   * @param {*} req
   * @param {*} res
   * @returns Speciality slots data
   */
  this.getSpecialitySlots = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.FROM_DATE, type: "string" },
        { key: Constant.TO_DATE, type: "string" },
      ];

      if (validateParams(req.query, keysAndTypeToCheck)) {
        const { speciality } = req.params;
        const data = await getSpecialitySlots({ ...req.query, speciality });
        res.json({
          status: true,
          data,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get slots between specified timeline of selected location.
   * @param {*} req
   * @param {*} res
   * @returns Get all slots of selected locations.
   */
  this.getSlots = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.FROM_DATE, type: "string" },
        { key: Constant.TO_DATE, type: "string" },
        { key: Constant.LOCATION_UUID, type: "string" },
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
      next(error);
    }
  };

  /**
   * Get appointments slots between specified timeline of selected speciality.
   * @param {*} req
   * @param {*} res
   * @returns Appointment slots data of speciality.
   */
  this.getAppointmentSlots = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.FROM_DATE, type: "string" },
        { key: Constant.TO_DATE, type: "string" },
        { key: Constant.SPECIALITY, type: "string" },
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

  /**
   * Request for book new appointment.
   * @param {*} req
   * @param {*} res
   * @returns Newly booked appointment.
   */
  this.bookAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.SLOT_DAY, type: "string" },
        { key: Constant.SLOT_DURATION, type: "number" },
        { key: Constant.SLOT_DURATION_UNIT, type: "string" },
        { key: Constant.SLOT_TIME, type: "string" },
        { key: Constant.SPECIALITY, type: "string" },
        { key: Constant.USER_UUID, type: "string" },
        { key: Constant.DR_NAME, type: "string" },
        { key: Constant.VISIT_UUID, type: "string" },
        { key: Constant.LOCATION_UUID, type: "string" },
        { key: Constant.PATIENT_NAME, type: "string" },
        { key: Constant.OPEN_MRS_ID, type: "string" },
        { key: Constant.HW_UUID, type: "string" },
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

  /**
   * Request for rechedule the appointment.
   * @param {*} req
   * @param {*} res
   * @returns updated appointment.
   */
  this.rescheduleAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.SLOT_DAY, type: "string" },
        { key: Constant.SLOT_DURATION, type: "number" },
        { key: Constant.SLOT_DURATION_UNIT, type: "string" },
        { key: Constant.SLOT_TIME, type: "string" },
        { key: Constant.SPECIALITY, type: "string" },
        { key: Constant.USER_UUID, type: "string" },
        { key: Constant.DR_NAME, type: "string" },
        { key: Constant.VISIT_UUID, type: "string" },
        { key: Constant.LOCATION_UUID, type: "string" },
        { key: Constant.PATIENT_NAME, type: "string" },
        { key: Constant.OPEN_MRS_ID, type: "string" },
        { key: Constant.HW_UUID, type: "string" },
        { key: Constant.APPOINTMENT_ID, type: "number" },
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

  /**
   * Request for cancel the appointment.
   * @param {*} req
   * @param {*} res
   * @returns Appointment.
   */
  this.cancelAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.ID, type: "number" },
        { key: Constant.VISIT_UUID, type: "string" },
        { key: Constant.HW_UUID, type: "string" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await _cancelAppointment(req.body);
        res.json(data);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Request for complete the appointment.
   * @param {*} req
   * @param {*} res
   * @returns Appointment.
   */
  this.completeAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [{ key: Constant.VISIT_UUID, type: "string" }];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await _completeAppointment(req.body);
        res.json(data);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Request for get the appointment.
   * @param {*} req
   * @param {*} res
   * @returns Appointment.
   */
  this.getAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [{ key: Constant.VISIT_UUID, type: "string" }];
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

  /**
   * Request for start the appointment.
   * @param {*} req
   * @param {*} res
   * @returns Appointment.
   */
  this.startAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.APPOINTMENT_ID, type: "number" },
        { key: Constant.DR_NAME, type: "string" },
        { key: Constant.USER_UUID, type: "string" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await startAppointment(req.body);
        res.json({ status: true, data });
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Request for release the appointment.
   * @param {*} req
   * @param {*} res
   * @returns Appointment.
   */
  this.releaseAppointment = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [{ key: Constant.VISIT_UUID, type: "string" }];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await releaseAppointment(req.body);
        res.json({ status: true, data });
      }
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * Request for update the dayoff.
   * @param {*} req
   * @param {*} res
   * @returns Dayoffs schedule.
   */
  this.updateDaysOff = async (req, res, next) => {
    const keysAndTypeToCheck = [
      { key: Constant.USER_UUID, type: "string" },
      { key: Constant.DAYS_OFF, type: "object" },
      { key: Constant.MONTH, type: "string" },
      { key: Constant.YEAR, type: "string" },
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
      next(error);
    }
  };

  /**
   * Request for book new appointment.
   * @param {*} req
   * @param {*} res
   * @returns Newly booked appointment.
   */
  this.appointmentPush = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: Constant.SLOT_DAY, type: "string" },
        { key: Constant.SLOT_DURATION, type: "number" },
        { key: Constant.SLOT_DURATION_UNIT, type: "string" },
        { key: Constant.SLOT_TIME, type: "string" },
        { key: Constant.SPECIALITY, type: "string" },
        { key: Constant.USER_UUID, type: "string" },
        { key: Constant.DR_NAME, type: "string" },
        { key: Constant.VISIT_UUID, type: "string" },
        { key: Constant.LOCATION_UUID, type: "string" },
        { key: Constant.PATIENT_NAME, type: "string" },
        { key: Constant.OPEN_MRS_ID, type: "string" },
        { key: Constant.HW_UUID, type: "string" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        await _bookAppointment(req.body);

        res.json({
          status: true,
          message: MESSAGE.APPOINTMENT.APPOINTMENT_PUSH_SUCCESSFULLY,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get dayoff based on date & time user unique id.
   * @param {*} req
   * @param {*} res
   */
  this.validateDayOff = async (req, res, next) => {
    console.log("CALLED")
    try {
      const { userUuid } = req.params;
      const { year, month, date, time } = req.query;
      const data = await validateDayOff({ userUuid, year, month, date, time });
      res.json({
        status: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  return this;
})();
