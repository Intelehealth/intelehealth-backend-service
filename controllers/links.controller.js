const { RES, generateHash } = require("../handlers/helper");
const { links } = require("../models");
const {
  requestPresctionOtp,
  verfifyPresctionOtp,
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
      const link = req.body.link;
      if (!link) {
        RES(res, { success: false, message: "Please pass link" }, 422);
        return;
      }
      let linkAlreadyExist = await links.findOne({
        where: { link },
        raw: true,
      });
      if (linkAlreadyExist) {
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
      const data = await links.create({ link, hash });
      RES(res, { success: true, data });
    } catch (error) {
      RES(res, { success: false, message: error.message }, 422);
    }
  };

  this.getLink = async (req, res) => {
    try {
      const hash = req.params.hash;

      const data = await links.findOne({
        where: { hash },
        attributes: ["link"],
        raw: true,
      });
      if (!data) {
        throw new Error("Invalid link!");
      }
      RES(res, { success: true, data });
    } catch (error) {
      RES(res, { success: false, message: error.message }, 422);
    }
  };

  this.requestOtp = async (req, res) => {
    try {
      const hash = req.body.hash;
      const phoneNumber = req.body.phoneNumber;

      await requestPresctionOtp(hash, phoneNumber);

      RES(res, { success: true });
    } catch (error) {
      RES(res, { success: false, message: error.message }, 422);
    }
  };

  this.verifyOtp = async (req, res) => {
    try {
      const hash = req.body.hash;
      const otp = req.body.otp;

      const data = await verfifyPresctionOtp(hash, otp);

      RES(res, { success: true, data });
    } catch (error) {
      RES(res, { success: false, message: error.message }, 422);
    }
  };

  return this;
})();
