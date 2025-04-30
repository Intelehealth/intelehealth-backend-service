const {
  _createUpdateStatus,
  _getStatuses,
  _getWebrtcStatuses
} = require("../services/user.service");
const { validateParams, log } = require("../handlers/helper");
const { logStream } = require("../logger/index");

module.exports = (function () {
  this.createUpdateStatus = async (req, res) => {
    const keysAndTypeToCheck = [
      { key: "userUuid", type: "string" },
      // { key: "device", type: "string" },
    ];
    try {
      if (validateParams(req.body, keysAndTypeToCheck)) {
        res.json({
          status: true,
          data: await _createUpdateStatus(req.body),
        });
      }
    } catch (error) {

      logStream("error", error.message);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  this.getStatuses = async (req, res) => {
    try {
      if (validateParams(req.params, [{ key: "userUuid", type: "string" }]))
        res.json({
          status: true,
          data: await _getStatuses(req.params.userUuid, req.query),
        });
    } catch (error) {
      
      logStream("error", error.message);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  this.getAllStatuses = async (req, res) => {
    try {
      res.json({
        status: true,
        data: await _getStatuses(null, req.query),
      });
    } catch (error) {
      logStream("error", error.message);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  this.getWebrtcStatuses = async (req, res) => {
    try {
      res.json({
        status: true,
        data: await _getWebrtcStatuses(),
      });
    } catch (error) {
      logStream("error", error.message);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  return this;
})();
