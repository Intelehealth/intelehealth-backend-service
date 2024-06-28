const { default: axios } = require("axios");
const { links } = require("../models");
const { MESSAGE } = require("../constants/messages");
const { logStream } = require("../logger/index");

module.exports = (function () {
  /**
   * Request otp for verification to view prescription
   * @param {string} hash - Hash 
   * @param {string} phoneNumber - Phone number
   */
  this.requestPresctionOtp = async (hash, phoneNumber) => {
    try {
      logStream('debug','PrescriptionLink Service', 'Request Presction Otp');
      const link = await links.findOne({
        where: {
          hash,
        },
      });

      if (!link) {
        throw new Error(MESSAGE.PRESCRIPTION.INVALID_LINK);
      }
      const otp = (
        await axios.get(
          `https://2factor.in/API/V1/${process.env.APIKEY_2FACTOR}/SMS/${phoneNumber}/AUTOGEN2`
        )
      ).data.OTP;
      logStream('debug','Success', 'Request Presction Otp');
      return await link.update({ otp });
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
    * Verify OTP sent for view prescription verification
    * @param { string } hash - Hash
    * @param { string } otp - OTP
    */
  this.verfifyPresctionOtp = async (hash, otp) => {
    logStream('debug','PrescriptionLink Service', 'Verify Prescription Otp');
    const link = await links.findOne({
      where: {
        hash,
      },
    });

    if (!link) {
      logStream("error", error.message);
      throw new Error(MESSAGE.PRESCRIPTION.INVALID_LINK);
    }

    if (link.otp === otp) {
      return true;
    } else {
      logStream("error", error.message);
      throw new Error(MESSAGE.PRESCRIPTION.INVALID_OTP);
    }
  };
  logStream('debug','Success', 'Verify Prescription Otp');
  return this;
})();
