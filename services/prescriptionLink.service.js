const { default: axios } = require("axios");
const { links } = require("../models");
const { MESSAGE } = require("../constants/messages");

module.exports = (function () {
  /**
   * Request otp for prescription
   */
  this.requestPresctionOtp = async (hash, phoneNumber) => {
    try {
      let link = await links.findOne({
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

      return await link.update({ otp });
    } catch (error) {
      throw error;
    }
  };

  this.verfifyPresctionOtp = async (hash, otp) => {
    let link = await links.findOne({
      where: {
        hash,
      },
    });

    if (!link) {
      throw new Error(MESSAGE.PRESCRIPTION.INVALID_LINK);
    }

    if (link.otp === otp) {
      return true;
    } else {
      throw new Error(MESSAGE.PRESCRIPTION.INVALID_OTP);
    }
  };

  return this;
})();
