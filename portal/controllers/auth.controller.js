const { MESSAGE } = require("../constants/messages");
const { RES } = require("../handlers/helper");
const { logStream } = require("../logger/index");
const {
  resetPassword,
  checkProviderAttribute,
  verifyOtp,
  requestOtp
} = require("../services/auth.service");

module.exports = (function () {
  /**
   * Request otp for forgot-username or forgot-password and sing in verification
   * @param {*} req
   * @param {*} res
   */
  this.requestOtp = async (req, res) => {
    try {
      logStream('debug', 'API calling', 'Request Otp');
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
            logStream('debug', 'Arguments Missing', 'Request Otp');
            RES(
              res,
              {
                success: false,
                message: MESSAGE.COMMON.BAD_REQUEST,
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
        logStream('debug', 'OTP Received', 'Request Otp');
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
        logStream('debug', 'Arguments Missing', 'Request Otp');
        RES(
          res,
          {
            success: false,
            message: MESSAGE.COMMON.BAD_REQUEST,
            data: null,
          },
          400
        );
      }
    } catch (error) {
      logStream("error", error.message);
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
      logStream('debug', 'API call', 'Verify Otp');
      const { email, phoneNumber, username, verifyFor, otp, countryCode} = req.body;
      if ((email || phoneNumber || username) && verifyFor && otp) {
        const data = await verifyOtp(
          email,
          phoneNumber,
          username,
          verifyFor,
          otp,
          countryCode
        );
        logStream('debug', 'Verified OTP', 'Verify Otp');
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
        logStream('debug', 'Arguments Missing', 'Verify Otp');
        RES(
          res,
          {
            success: false,
            message: MESSAGE.COMMON.BAD_REQUEST,
            data: null,
          },
          400
        );
      }
    } catch (error) {
      logStream("error", error.message);
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
      logStream('debug', 'API call', 'Reset Password');
      const { userUuid } = req.params;
      const { newPassword } = req.body;

      if (userUuid && newPassword) {
        const data = await resetPassword(userUuid, newPassword);
        logStream('debug', 'Reset Password Success', 'Reset Password');
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
        logStream('debug', 'Arguments Missing', 'Reset Password');
        RES(
          res,
          {
            success: false,
            message: MESSAGE.COMMON.BAD_REQUEST,
            data: null,
          },
          400
        );
      }
    } catch (error) {
      logStream("error", error.message);
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
   * Check the current session remember me. 
   * @param {*} req
   * @param {*} res
   */
  this.checkSession = async (req, res) => {
    logStream('debug', 'API call', 'Check Session');
    RES(res, {
      success: true,
      rememberme: req.session.rememberme,
    });
  };

  /**
   * Funtion for making remember me login during requested session.
   * @param {*} req
   * @param {*} res
   */
  this.rememberme = async (req, res) => {
    req.session.rememberme = true;
    req.session.userUuid = req.body.userUuid;
    logStream('debug', 'Remember me Success', 'Check Session');
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
      logStream('debug', 'API call', 'Check Provider Attribute');
      const { attributeType, attributeValue, providerUuid } = req.body;
      if (attributeType && attributeValue) {
        if (!["emailId", "phoneNumber"].includes(attributeType)) {
          logStream('debug', 'Bad Request', 'Check Provider Attribute');
          RES(
            res,
            {
              success: false,
              message: MESSAGE.AUTH.BAD_REQUEST_ATTRIBUTE_SHOULD_BE_EMAILID_PHONE_NUMBER,
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
        logStream('debug', 'Success', 'Check Provider Attribute');
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
        logStream('debug', 'Bad Request', 'Check Provider Attribute');
        RES(
          res,
          {
            success: false,
            message: MESSAGE.COMMON.BAD_REQUEST,
            data: null,
          },
          400
        );
      }
    } catch (error) {
      logStream("error", error.message);
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
