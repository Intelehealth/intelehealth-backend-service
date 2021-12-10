const { validateParams } = require("../handlers/helper");
const {
  getUserAppointmentSchedule,
  upsertAppointmentSchedule,
  getAppointmentSlots,
} = require("../services/appointment.service");

module.exports = (function () {
  /**
   * Update a schedule if aalready exist otherwise create a new w.r.t. userUuid
   * @param {*} req
   * @param {*} res
   */
  this.upsertSchedule = async (req, res) => {
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
      res.json({
        status: false,
        message: error,
      });
    }
  };

  this.getAppointmentSchedule = async (req, res) => {
    try {
      const userUuid = req.params.userUuid;
      const data = await getUserAppointmentSchedule({ where: { userUuid } });
      res.json({
        status: true,
        data,
      });
    } catch (error) {
      console.log("error: ", error);
      res.json({
        status: false,
        message: error,
      });
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
          data,
        });
      }
    } catch (error) {
      next(error);
    }
  };

  return this;
})();
