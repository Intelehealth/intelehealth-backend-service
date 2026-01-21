const { RES } = require("../handlers/helper");
const { logStream } = require("../logger/index");
const { getNcdReportData } = require("../services/ncdReport.service");

module.exports = (function () {
  /**
   * Get NCD report data for a patient by patient UUID
   * Returns JSON data for frontend consumption
   * @param {*} req
   * @param {*} res
   * @returns JSON NCD report data
   */
  this.getNcdReportDataByPatient = async (req, res) => {
    try {
      logStream("debug", "API call", "Get NCD Report Data");
      const { patientUuid } = req.params;

      if (!patientUuid) {
        RES(
          res,
          {
            success: false,
            message: "Patient UUID is required",
          },
          422
        );
        return;
      }

      const reportData = await getNcdReportData(patientUuid);

      logStream("debug", "Success", "Get NCD Report Data");
      RES(res, { success: true, data: reportData });
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, 422);
    }
  };

  return this;
})();
