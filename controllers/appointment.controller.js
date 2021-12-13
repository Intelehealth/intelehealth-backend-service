const { validateParams } = require("../handlers/helper");
const {
  getUserAppointmentSchedule,
  upsertAppointmentSchedule,
  getAppointmentSlots,
  bookAppointment,
  getUserSlots,
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
      { key: "slotDays", type: "string" },
      { key: "slotSchedule", type: "object" },
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
      const data = await getUserAppointmentSchedule({ where: { userUuid } });
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

  this.getAppointmentSlots = async (req, res, next) => {
    try {
      const keysAndTypeToCheck = [
        { key: "fromDate", type: "string" },
        { key: "toDate", type: "string" },
        { key: "speciality", type: "string" },
      ];
      if (validateParams(req.query, keysAndTypeToCheck)) {
        const data = await getAppointmentSlots(req.query);
        res.json({
          status: true,
          ...data,
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
        { key: "patientName", type: "string" },
        { key: "openMrsId", type: "string" },
      ];
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await bookAppointment(req.body);
        res.json({
          status: true,
          ...data,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  return this;
})();
