const { RES } = require("../handlers/helper");
const {
  requestOtp,
  verfifyOtp,
  resetPassword,
  checkProviderAttribute
} = require("../services/auth.service");

module.exports = (function () {
  /**
   * Request otp for forgot-username or forgot-password and sing in verification
   * @param {*} req
   * @param {*} res
   */
  this.requestOtp = async (req, res) => {
    try {
      const {
        email,
        phoneNumber,
        countryCode = 91,
        username,
        otpFor,
      } = req.body;
      if ((email || phoneNumber || username) && otpFor) {
        if (phoneNumber) {
          if (!countryCode) {
            RES(
              res,
              {
                success: false,
                message: "Bad request! Invalid arguments.",
                data: null,
              },
              400
            );
          }
        }
        const data = await requestOtp(
          email,
          phoneNumber,
          countryCode,
          username,
          otpFor
        );
        RES(
          res,
          {
            success: data.success,
            message: data.message,
            data: data.data,
          },
          data.code
        );
      } else {
        RES(
          res,
          {
            success: false,
            message: "Bad request! Invalid arguments.",
            data: null,
          },
          400
        );
      }
    } catch (error) {
      if (error.code === null || error.code === undefined) {
        error.code = 500;
      }
      RES(
        res,
        { success: false, data: error.data, message: error.message },
        error.code
      );
    }
  };

  /**
   * Verify otp sent for forgot-username or forgot-password and sing in verification and perform the appropiate action further required like send username, update new password etc.
   * @param {*} req
   * @param {*} res
   */
  this.verifyOtp = async (req, res) => {
    try {
      const { email, phoneNumber, username, verifyFor, otp } = req.body;
      if ((email || phoneNumber || username) && verifyFor && otp) {
        const data = await verfifyOtp(
          email,
          phoneNumber,
          username,
          verifyFor,
          otp
        );
        RES(
          res,
          {
            success: data.success,
            message: data.message,
            data: data.data,
          },
          data.code
        );
      } else {
        RES(
          res,
          {
            success: false,
            message: "Bad request! Invalid arguments.",
            data: null,
          },
          400
        );
      }
    } catch (error) {
      if (error.code === null || error.code === undefined) {
        error.code = 500;
      }
      RES(
        res,
        { success: false, data: error.data, message: error.message },
        error.code
      );
    }
  };

  /**
   * update new password if otp is validated.
   * @param {*} req
   * @param {*} res
   */
  this.resetPassword = async (req, res) => {
    try {
      const userUuid = req.params.userUuid;
      const newPassword = req.body.newPassword;

      if (userUuid && newPassword) {
        const data = await resetPassword(userUuid, newPassword);
        RES(
          res,
          {
            success: data.success,
            message: data.message,
            data: data.data,
          },
          data.code
        );
      } else {
        RES(
          res,
          {
            success: false,
            message: "Bad request! Invalid arguments.",
            data: null,
          },
          400
        );
      }
    } catch (error) {
      if (error.code === null || error.code === undefined) {
        error.code = 500;
      }
      RES(
        res,
        { success: false, data: error.data, message: error.message },
        error.code
      );
    }
  };

  this.checkSession = async (req, res) => {
    RES(res, {
      success: true,
      rememberme: req.session.rememberme,
    });
  };

  this.rememberme = async (req, res) => {
    req.session.rememberme = true;
    req.session.userUuid = req.body.userUuid;

    RES(res, {
      success: true,
      rememberme: req.session.rememberme,
      userUuid: req.session.userUuid,
    });
  };

  /**
   * Check if provider attribute phoneNumber/emailId value already exists or not
   * @param {*} req
   * @param {*} res
   */
  this.checkProviderAttribute = async (req, res) => {
    try {
      const {
        attributeType,
        attributeValue,
        providerUuid,
      } = req.body;
      if (attributeType && attributeValue && providerUuid) {
        if (!['emailId','phoneNumber'].includes(attributeType)) {
          RES(
              res,
              {
                success: false,
                message: "Bad request! Attribute type should be emailId/phoneNumber.",
                data: null,
              },
              400
          );
        }
        const data = await checkProviderAttribute(
          attributeType,
          attributeValue,
          providerUuid
        );
        RES(
          res,
          {
            success: data.success,
            message: data.message,
            data: data.data,
          },
          data.code
        );
      } else {
        RES(
          res,
          {
            success: false,
            message: "Bad request! Invalid arguments.",
            data: null,
          },
          400
        );
      }
    } catch (error) {
      if (error.code === null || error.code === undefined) {
        error.code = 500;
      }
      RES(
        res,
        { success: false, data: error.data, message: error.message },
        error.code
      );
    }
  };

  return this;
})();