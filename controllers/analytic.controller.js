const { log } = require("../handlers/helper");
const { _trackActions } = require("../services/analytic.service");

module.exports = (function () {
  this.trackAction = async (req, res) => {
    const keysAndTypeToCheck = [
      { key: "userUuid", type: "string" },
      { key: "visitId", type: "string" },
      { key: "action", type: "string" },
      { key: "openMrsId", type: "string" },
    ];
    try {
      if (validateParams(req.body, keysAndTypeToCheck)) {
        res.json({
          status: true,
          data: await _trackActions(req.body),
        });
      }
    } catch (error) {
      log("error: ", error);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  this.getActions = async (req, res) => {
    try {
      if (validateParams(req.params, [{ key: "userUuid", type: "string" }]))
        res.json({
          status: true,
          data: await _getActions(req.params.userUuid, req.query),
        });
    } catch (error) {
      log("error: ", error);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  return this;
})();
