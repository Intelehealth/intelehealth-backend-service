const { MESSAGE } = require("../constants/messages");
const { RES, generateHash } = require("../handlers/helper");
const { links } = require("../models");
const { logStream } = require("../logger/index");
const {
  requestPresctionOtp,
  verfifyPresctionOtp,
  getFacilityContacts,
  getFacilityContactById
} = require("../services/prescriptionLink.service");

module.exports = (function () {
  /**
   * Convert a long link into a shorter link
   * @param {*} req
   * @param {*} res
   * @returns shortend link
   */
  this.shortLink = async (req, res) => {
    try {
      logStream('debug', 'API call', 'Create Short Link');
      let { link, type } = req.body;

      if(!type) type = "presctiption-verification";

      if (!link) {
        RES(res, { success: false, message: MESSAGE.LINK.PLEASE_PASS_LINK }, 422);
        return;
      }
      const linkAlreadyExist = await links.findOne({
        where: { link, type },
        raw: true,
      });
      if (linkAlreadyExist) {
        logStream('debug', 'Link Already Exist', 'Create Short Link');
        RES(res, { success: true, data: linkAlreadyExist });
        return;
      }
      let len = 2;
      let tried = 0;
      let hash;
      let exist;
      while (!exist) {
        if (tried > 2) len++;
        hash = generateHash(len);
        exist = !(await links.findOne({
          where: { hash },
          raw: true,
        }));
        tried++;
      }
      const data = await links.create({ link, hash, type });
      logStream('debug', 'Success', 'Create Short Link');
      RES(res, { success: true, data });
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, 422);
    }
  };

  /**
   * Request for get Link
   * @param {*} req
   * @param {*} res
   */
  this.getLink = async (req, res) => {
    try {
      logStream('debug', 'API call', 'Get Link');
      const { hash } = req.params;

      const data = await links.findOne({
        where: { hash },
        attributes: ["link","type"],
        raw: true,
      });
      if (!data) {
        logStream('debug', 'Invalid Link', 'Get Link');
        throw new Error(MESSAGE.COMMON.INVALID_LINK);
      }
      logStream('debug', 'Success', 'Get Link');
      RES(res, { success: true, data });
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, 422);
    }
  };

  /**
   * Request otp for prescription validation
   * @param {*} req
   * @param {*} res
   */
  this.requestOtp = async (req, res) => {
    try {
      logStream('debug', 'API call', 'Request Otp');
      const { hash, phoneNumber } = req.body;
      await requestPresctionOtp(hash, phoneNumber);
      logStream('debug', 'Success', 'Request Otp');
      RES(res, { success: true });
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, 422);
    }
  };

  /**
   * Verify otp for prescription validation
   * @param {*} req
   * @param {*} res
   */
  this.verifyOtp = async (req, res) => {
    try {
      logStream('debug', 'API call', 'Verify Otp');
      const { hash, otp } = req.body;
      const data = await verfifyPresctionOtp(hash, otp);
      logStream('debug', 'Success', 'Verify Otp');
      RES(res, { success: true, data });
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, 422);
    }
  };


  /**
   * Get List of Facility Contacts
   *  @param {*} req
   *  @param {*} res
   *  @returns facility contact list
   */
  this.getFacilityContactsList = async (req, res) => {
    try {
      logStream('debug', 'API call', 'Get List of Facility Contacts');
      const data = await getFacilityContacts();
      logStream('debug', 'Success', 'Get List of Facility Contacts');
      RES(res, { success: true, data });
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, 422);
    }
  };


  /**
   * Get Facility Contactd by Id
   * @param {*} req
   * @param {*} res
   * @returns facility contact
   */
  this.getFacilityContactById = async (req, res) => {
    try {
      logStream('debug', 'API call', 'Get Facility Contact by Id');
      const { id } = req.params;
      const data = await getFacilityContactById(id);
      logStream('debug', 'Success', 'Get Facility Contact by Id');
      RES(res, { success: true, data });
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, 422);
    }
  };

  return this;
})();
