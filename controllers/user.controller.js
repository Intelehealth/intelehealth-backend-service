const {
  _createUpdateStatus,
  _getStatuses,
  _profile,
} = require("../services/user.service");
const { validateParams } = require("../handlers/helper");

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
      console.log("error: ", error);
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
      console.log("error: ", error);
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
      console.log("error: ", error);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  this.profile = async (req, res) => {
    try {
      res.json({
        status: true,
        data: await _profile(req.params.userUuid, req.query),
        message: "Date fetched successfully!",
      });
    } catch (error) {
      console.log("error: ", error);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  this.updateProfile = async (req, res) => {
    try {
      res.json({
        status: true,
        data: await _updateProfile(req.params.userUuid, req.body),
        message: "Updated successfully!",
      });
    } catch (error) {
      console.log("error: ", error);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  return this;
})();
