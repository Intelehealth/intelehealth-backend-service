const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const axios = require("axios");
const { user_settings } = require("../models");
const { axiosInstance } = require("../handlers/helper");
const functions = require("../handlers/functions");
const moment = require("moment");
const otpGenerator = require("otp-generator");
const fs = require("fs");

module.exports = (function () {
  const saveOtp = async function (userUuid, otp, otpFor) {
    let user = await user_settings.findOne({
      where: { user_uuid: userUuid },
    });

    if (user) {
      user.otp = otp;
      user.otpFor = otpFor;
      await user.save();
    } else {
      user = await user_settings.create({
        user_uuid: userUuid,
        otp,
        otpFor,
      });
    }
    return user;
  };

  const sendOtp = async function (destination, countryCode, otpFor, userUuid) {
    const phoneNumber = otpFor === "username" ? destination : null;
    const email = otpFor === "password" ? destination : null;

    const data = await getUserData(phoneNumber, email, otpFor, userUuid);

    if (data.length) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].attributeTypeName === "phoneNumber") {
          const otp = await getOtpFrom2Factor(
            `+${countryCode}${phoneNumber}`
          ).catch((error) => {
            throw new Error(error.message);
          });

          await saveOtp(data[i].uuid, otp.data.OTP, otpFor);
        }

        if (data[i].attributeTypeName === "emailId") {
          const randomOtp = otpGenerator.generate(6, {
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
          });

          await sendEmailOtp(email, "Verification code", randomOtp);
          await saveOtp(data[i].uuid, randomOtp, otpFor);
        }
      }

      return {
        code: 200,
        success: true,
        message: "Otp sent successfully!",
        data: null,
      };
    } else {
      return {
        code: 200,
        success: false,
        message: "No user exists with this phone number/email.",
        data: null,
      };
    }
  };

  const getUserData = async function (phoneNumber, email, otpFor, userUuid) {
    let query;
    switch (otpFor) {
      case "username":
        query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${
          phoneNumber ? phoneNumber : email
        }' AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
        break;

      case "password":
        query = `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${
          phoneNumber ? phoneNumber : email
        }' AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
        break;

      case "verification":
        query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${
          phoneNumber ? phoneNumber : email
        }' AND (u.username = '${userUuid}' OR u.system_id = '${userUuid}') AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
        break;

      default:
        break;
    }

    const data = await new Promise((resolve, reject) => {
      openMrsDB.query(query, (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      throw err;
    });

    return data;
  };

  const getOtpFrom2Factor = async function (phoneNumber) {
    return axios.get(
      `https://2factor.in/API/V1/${process.env.APIKEY_2FACTOR}/SMS/${phoneNumber}/AUTOGEN2`
    );
  };

  const sendEmailOtp = async function (email, subject, otp) {
    const otpTemplate = fs
      .readFileSync("./common/emailtemplates/otpTemplate.html", "utf8")
      .toString();

    const replacedTemplate = otpTemplate
      .replace("$otpFor", subject)
      .replace("$otp", otp);

    await functions.sendEmail(
      email,
      `${subject} for Intelehealth`,
      replacedTemplate
    );
  };

  const verifyOtp = async function (
    destination,
    countryCode,
    username,
    verifyFor,
    otp
  ) {
    try {
      const env = process.env.NODE_ENV || "production";
      const data = await getUserData(destination, null, verifyFor, username);

      if (data.length) {
        let user;
        for (let i = 0; i < data.length; i++) {
          user = await user_settings.findOne({
            where: {
              user_uuid: data[i].uuid,
              otp: otp,
              otpFor: verifyFor.charAt(0).toUpperCase(),
            },
          });

          if (user) {
            break;
          }
        }

        if (user) {
          if (moment().diff(moment(user.updatedAt), "minutes") < 5) {
            return {
              code: 200,
              success: true,
              message: "Otp verified successfully!",
              data: null,
            };
          } else {
            return {
              code: 200,
              success: false,
              message: "Otp expired!",
              data: null,
            };
          }
        } else {
          return {
            code: 200,
            success: false,
            message: "Otp incorrect!",
            data: null,
          };
        }
      } else {
        return {
          code: 200,
          success: false,
          message: "No user exists with this phone number/email.",
          data: null,
        };
      }
    } catch (error) {
      if (error.code === null || error.code === undefined) {
        error.code = 500;
      }
      return {
        code: error.code,
        success: false,
        data: error.data,
        message: error.message,
      };
    }
  };

  const resetPassword = async function (userUuid, newPassword) {
    try {
      const url = `/openmrs/ws/rest/v1/password/${userUuid}`;
      let user = await user_settings.findOne({
        where: {
          user_uuid: userUuid,
          otpFor: "P",
        },
      });

      if (user) {
        const payload = {
          newPassword,
        };

        await axiosInstance.post(url, payload).catch((err) => {
          console.log("Openmrs API - err: ", err.body);
        });

        return {
          code: 200,
          success: true,
          message: "Password reset successful.",
          data: null,
        };
      } else {
        return {
          code: 200,
          success: false,
          message: "No user exists!",
          data: null,
        };
      }
    } catch (error) {
      if (error.code === null || error.code === undefined) {
        error.code = 500;
      }
      return {
        code: error.code,
        success: false,
        data: error.data,
        message: error.message,
      };
    }
  };

  const checkProviderAttribute = async function (
    attributeType,
    attributeValue,
    providerUuid
  ) {
    try {
      let query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id WHERE pat.name = '${attributeType}' AND pa.value_reference = '${attributeValue}' AND p.retired = 0 AND pa.voided = false AND p.uuid != '${providerUuid}'`;
      let data = await new Promise((resolve, reject) => {
        openMrsDB.query(query, (err, results, fields) => {
          if (err) reject(err);
          resolve(results);
        });
      }).catch((err) => {
        throw err;
      });

      if (data.length) {
        return {
          code: 200,
          success: true,
          message: `${attributeType.toUpperCase()} already exists!`,
          data: false,
        };
      } else {
        return {
          code: 200,
          success: true,
          message: `${attributeType.toUpperCase()} does not exist!`,
          data: true,
        };
      }
    } catch (error) {
      if (error.code === null || error.code === undefined) {
        error.code = 500;
      }
      return {
        code: error.code,
        success: false,
        data: error.data,
        message: error.message,
      };
    }
  };

  return {
    saveOtp,
    sendOtp,
    verifyOtp,
    resetPassword,
    checkProviderAttribute,
  };
})();
