const { default: axios } = require("axios");
const { links, facility_contacts} = require("../models");
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
      throw new Error(MESSAGE.PRESCRIPTION.INVALID_LINK);
    }

    if (link.otp === otp) {
      logStream('debug','Success', 'Verify Prescription Otp');
      return true;
    } else {
      throw new Error(MESSAGE.PRESCRIPTION.INVALID_OTP);
    }
  };

  /**
    * get List of facility contacts
    */
  this.getFacilityContacts = async () => {
    logStream('debug','PrescriptionLink Service', 'Get Facility Contacts');
    return await facility_contacts.findAll();
  };

  /**
    * get Facility Contact by Id
    */
  this.getFacilityContactById = async (id) => {
    logStream('debug','PrescriptionLink Service', 'Get Facility Contacts');
    const facility_contact = await facility_contacts.findOne({ where: { id } });
    if (!facility_contact) {
      throw new Error("Facility Contact not found");
    }
    return facility_contact;
  };
  return this;
})();
