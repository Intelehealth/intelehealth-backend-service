const openMrsDB = require("../handlers/mysql/mysqlOpenMrs");
const axios = require("axios");
const { user_settings } = require("../models");
const { axiosInstance } = require("../handlers/helper");
const functions = require("../handlers/functions");
const moment = require("moment");
const otpGenerator = require("otp-generator");
const fs = require("fs");
const { MESSAGE } = require("../constants/messages");
const Constant = require("../constants/constant");

module.exports = (function () {
  /**
     * Save otp to database
     * @param { string } userUuid - User uuid
     * @param { string } otp - OTP
     * @param { string } otpFor - otp for
     */
  const saveOtp = async function (userUuid, otp, otpFor) {
    let user = await user_settings.findOne({
      where: { user_uuid: userUuid }
    });

    if (user) {
      user.otp = otp;
      user.otpFor = otpFor;
      await user.save();
    } else {
      user = await user_settings.create({
        user_uuid: userUuid,
        otp,
        otpFor
      });
    }
    return user;
  };

  /**
     * Verify otp
     * @param { string } email - Email of the provider
     * @param { string } phonenumber - Phone number of the provider
     * @param { string } username - Username of the provider
     * @param { string } verifyFor - Verification for
     * @param { string } otp - OTP
     */
  const getOtpFrom2Factor = async function (phoneNumber) {
    return axios.get(
      `https://2factor.in/API/V1/${process.env.APIKEY_2FACTOR}/SMS/${phoneNumber}/AUTOGEN2`
    );
  };

  /**
     * Send email containing otp
     * @param { string } email - Email of the provider
     * @param { string } subject - Subject for email
     * @param { string } otp - OTP
     */
  const sendEmailOtp = async function (email, subject, otp) {
    const otpTemplate = fs
      .readFileSync("./common/emailtemplates/otpTemplate.html", "utf8")
      .toString();

    const replacedTemplate = otpTemplate
      .replace("$otpFor", subject)
      .replace("$otp", otp);

    return await functions.sendEmail(
      email,
      subject,
      replacedTemplate
    ).catch((error) => { throw error });
  };

  const sendEmailSuccess = async function (email, subject) {
    const emailTemplate = fs
      .readFileSync("./common/emailtemplates/emailTemplate.html", "utf8")
      .toString();

    return await functions.sendEmail(
      email,
      subject,
      emailTemplate
    ).catch((error) => { throw error });
  };

  /**
     * Send Email containing provider username
     * @param { string } email - Email of the provider
     * @param { string } subject - Subject for the email
     * @param { string } username - Username of the provider
     */
  const sendEmailUsername = async function (email, subject, username) {
    const otpTemplate = fs
      .readFileSync("./common/emailtemplates/usernameTemplate.html", "utf8")
      .toString();

    const replacedTemplate = otpTemplate
      .replace("$username", username);

    return await functions.sendEmail(
      email,
      subject,
      replacedTemplate
    ).catch((error) => { throw error });
  };

  /**
     * Get user data
     * @param { string } phonenumber - Phone number of the provider
     * @param { string } email - Email of the provider
     * @param { string } username - Username of the provider
     * @param { string } dataFor - Data for which operation like username, password or verification.
     */
  const getUserData = async function (phoneNumber, email, username, dataFor) {
    let query;
    switch (dataFor) {
      case "username":
        query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${phoneNumber || email}' AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
        break;

      case "password":
        if (username) {
          query = `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM users u LEFT JOIN provider p ON p.person_id = u.person_id WHERE u.username = '${username}' OR u.system_id = '${username}' AND p.retired = 0 AND u.retired = 0;`;
        } else if (phoneNumber || email) {
          query = `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${phoneNumber || email}' AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
        }
        break;

      case "verification":
        query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${phoneNumber || email}' AND (u.username = '${username}' OR u.system_id = '${username}') AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
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

  /**
     * Send otp
     * @param { string } email - Email of the provider
     * @param { string } phonenumber - Phone number of the provider
     * @param { string } countryCode - Country code of the phone number
     * @param { string } username - Username of the provider
     * @param { string } otpFor - Verification for
     */
  const requestOtp = async function (email, phoneNumber, countryCode, username, otpFor) {
    try {
      let attributes;
      if (![Constant.USERNAME, Constant.PASSWORD, Constant.VERIFICATON].includes(otpFor)) {
        return {
          code: 400,
          success: false,
          message: MESSAGE.COMMON.BAD_REQUEST,
          data: null
        }
      }

      const data = await getUserData(phoneNumber, email, username, otpFor);
      if (data.length) {
        if (otpFor === Constant.USERNAME || otpFor === Constant.VERIFICATON) {
          for (const element of data) {
            if (element.attributeTypeName == Constant.PHONE_NUMBER) {
              // Make send OTP request
              const otp = await getOtpFrom2Factor(`+${countryCode}${phoneNumber}`).catch(error => {
                throw new Error(error.message);
              });
              if (otp) {
                // Save OTP in database for verification
                await saveOtp(element.uuid, otp.data.OTP, otpFor === Constant.USERNAME ? "U" : "A");
              }
            }

            if (element.attributeTypeName == Constant.EMAIL_ID) {
              // Send email here
              const randomOtp = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
              const mail = await sendEmailOtp(email, otpFor === Constant.USERNAME ? MESSAGE.AUTH.VERIFICATION_CODE_FOR_FORGOT_USERNAME : MESSAGE.AUTH.VERIFICATION_CODE_FOR_SIGN_IN, randomOtp);
              if (mail.messageId) {
                // Save OTP in database for verification
                await saveOtp(element.uuid, randomOtp, otpFor === Constant.USERNAME ? "U" : "A");
              }
            }
          }
          return {
            code: 200,
            success: true,
            message: MESSAGE.AUTH.OTP_SENT_SUCCESSFULLY,
            data: null
          };
        } else {
          // Get phoneNumber and email of the user
          attributes = await new Promise((resolve, reject) => {
            openMrsDB.query(
              `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pat.provider_attribute_type_id = pa.attribute_type_id WHERE pa.provider_id = ${data[0].provider_id} AND (pat.name = 'emailId' OR pat.name = 'phoneNumber' OR pat.name = 'countryCode') AND pa.voided = false`,
              (err, results, fields) => {
                if (err) reject(err);
                resolve(results);
              }
            );
          }).catch((err) => {
            throw err;
          });

          if (attributes.length) {
            for (const element of attributes) {
              if (element.attributeTypeName == Constant.PHONE_NUMBER) {
                phoneNumber = element.attributeValue
              }
              if (element.attributeTypeName == Constant.COUNTRY_CODE) {
                countryCode = element.attributeValue
              }
              if (element.attributeTypeName == Constant.EMAIL_ID) {
                email = element.attributeValue
              }
            }

            // If phoneNumber and countryCode exists
            if (phoneNumber && countryCode) {
              // Make request
              const otp = await getOtpFrom2Factor(`+${countryCode}${phoneNumber}`).catch(error => {
                throw new Error(error.message);
              });
              if (otp) {
                // Save OTP in database for verification
                await saveOtp(data[0].userUuid, otp.data.OTP, "P");
                if (email) {
                  await sendEmailOtp(email, MESSAGE.AUTH.VERIFICATION_CODE_FOR_FORGOT_PASSWORD, otp.data.OTP);  
                }
              }
            } else if (email) {
              // Send email here
              const randomOtp = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
              const mail = await sendEmailOtp(email, MESSAGE.AUTH.VERIFICATION_CODE_FOR_FORGOT_PASSWORD, randomOtp);
              if (mail.messageId) {
                // Save OTP in database for verification
                await saveOtp(data[i].uuid, randomOtp, "P");
              }
            }

            return {
              code: 200,
              success: true,
              message: MESSAGE.AUTH.OTP_SENT_SUCCESSFULLY,
              data: {
                userUuid: data[0].userUuid,
                providerUuid: data[0].providerUuid
              }
            }
          } else {
            return {
              code: 200,
              success: false,
              message: MESSAGE.AUTH.NO_PHONENUMBER_EMAIL_UPDATED_FOR_THIS_USERNAME,
              data: null
            }
          }
        }
      } else {
        return {
          code: 200,
          success: false,
          message: MESSAGE.AUTH.NO_USER_EXISTS_WITH_THIS_PHONE_NUMBER_EMAIL_USERNAME,
          data: null
        }
      }
    } catch (error) {
      if (error.code === null || error.code === undefined) {
        error.code = 500;
      }
      return { code: error.code, success: false, data: error.data, message: error.message };
    }
  };

  /**
     * Verify otp
     * @param { string } email - Email of the provider
     * @param { string } phonenumber - Phone number of the provider
     * @param { string } username - Username of the provider
     * @param { string } verifyFor - Verification for
     * @param { string } otp - OTP
     */
  const verifyOtp = async function (email, phoneNumber, username, verifyFor, otp, countryCode = 91) {
    try {
      let user, index;

      if (![Constant.USERNAME, Constant.PASSWORD, Constant.VERIFICATON].includes(verifyFor)) {
        return {
          code: 400,
          success: false,
          message: MESSAGE.COMMON.BAD_REQUEST,
          data: null
        }
      }

      const data = await getUserData(phoneNumber, email, username, verifyFor);

      if (data.length) {
        switch (verifyFor) {
          case Constant.USERNAME:
            for (let i = 0; i < data.length; i++) {
              user = await user_settings.findOne({
                where: {
                  user_uuid: data[i].uuid,
                  otp: otp,
                  otpFor: 'U'
                },
              });
              if (user) {
                index = i;
                break;
              }
            }

            if (user) {
              if (moment().diff(moment(user.updatedAt), "minutes") < 5) {
                //TODO: Code for send otp to phone number.
                if (phoneNumber) {
                  const body = new URLSearchParams();
                  body.append('module', 'TRANS_SMS');
                  body.append('apikey', process.env.APIKEY_2FACTOR);
                  body.append('to', `+${countryCode}${phoneNumber}`);
                  body.append('from', 'TIFDOC');
                  body.append('msg', `Welcome to Intelehealth. Please use the username ${data[index].username} to sign in at Intelehealth.`);
                  const otp = await axios.post(`https://2factor.in/API/R1/`, body, {
                      headers: { 
                        "Content-Type": "application/x-www-form-urlencoded"
                      }
                  }).catch(error => {
                      throw new Error(error.message);
                  });
                  // if (otp) {

                  // }
                }

                if (email) {
                  await sendEmailUsername(email, MESSAGE.AUTH.YOUR_ACCOUNT_CREDENTIALS_AT_INTELEHEALTH, data[index].username);
                }
                return {
                  code: 200,
                  success: true,
                  message: MESSAGE.AUTH.OTP_VERIFIED_SUCCESSFULLY,
                  data: null
                };
              } else {
                return {
                  code: 200,
                  success: false,
                  message: MESSAGE.AUTH.OTP_EXPIRED,
                  data: null
                };
              }
            } else {
              return {
                code: 200,
                success: false,
                message: MESSAGE.AUTH.OTP_INCORRECT,
                data: null
              };
            }

          case Constant.PASSWORD:
            user = await user_settings.findOne({
              where: {
                user_uuid: data[0].userUuid,
                otp: otp,
                otpFor: 'P'
              },
            });
            if (user) {
              if (moment().diff(moment(user.updatedAt), "minutes") < 5) {
                // Send username here

                return {
                  code: 200,
                  success: true,
                  message: MESSAGE.AUTH.OTP_VERIFIED_SUCCESSFULLY,
                  data: {
                    userUuid: data[0].userUuid,
                    providerUuid: data[0].providerUuid
                  }
                };
              } else {
                return {
                  code: 200,
                  success: false,
                  message: MESSAGE.AUTH.OTP_EXPIRED,
                  data: null
                };
              }
            } else {
              return {
                code: 200,
                success: false,
                message: MESSAGE.AUTH.OTP_INCORRECT,
                data: null
              };
            }

          case Constant.VERIFICATON:
            for (const element of data) {
              user = await user_settings.findOne({
                where: {
                  user_uuid: element.uuid,
                  otp: otp,
                  otpFor: 'A'
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
                  message: MESSAGE.AUTH.OTP_VERIFIED_SUCCESSFULLY,
                  data: null
                };
              } else {
                return {
                  code: 200,
                  success: false,
                  message: MESSAGE.AUTH.OTP_EXPIRED,
                  data: null
                };
              }
            } else {
              return {
                code: 200,
                success: false,
                message: MESSAGE.AUTH.OTP_EXPIRED,
                data: null
              };
            }

          default:
            break;
        }
      } else {
        return {
          code: 200,
          success: false,
          message: MESSAGE.AUTH.NO_USER_EXISTS_WITH_THIS_PHONE_NUMBER_EMAIL_USERNAME,
          data: null
        }
      }
    } catch (error) {
      if (error.code === null || error.code === undefined) {
        error.code = 500;
      }
      return { code: error.code, success: false, data: error.data, message: error.message };
    }
  };

  /**
     * Reset openmrs password
     * @param { string } userUuid - User uuid
     * @param { string } newPassword - New password
     */
  const resetPassword = async function (userUuid, newPassword) {
    try {
      const url = `/openmrs/ws/rest/v1/password/${userUuid}`;
      let user = await user_settings.findOne({
        where: {
          user_uuid: userUuid,
          otpFor: "P",
        },
      });

      let person = await new Promise((resolve, reject) => {
        openMrsDB.query(
          `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM users u LEFT JOIN provider p ON p.person_id = u.person_id WHERE u.uuid = '${userUuid}' OR u.system_id = '${userUuid}' AND p.retired = 0 AND u.retired = 0;`,        
          (err, results, fields) => {
            if (err) reject(err);
            resolve(results);
          }
        );
      }).catch((err) => {
        throw err;
      });

      if (user) {
        const payload = {
          newPassword,
        };

        await axiosInstance.post(url, payload).catch((err) => {
          throw err;
        });

        // Get phoneNumber and email of the user
        let attributes = await new Promise((resolve, reject) => {
          openMrsDB.query(
            `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pat.provider_attribute_type_id = pa.attribute_type_id WHERE pa.provider_id = ${person[0].provider_id} AND (pat.name = 'emailId' OR pat.name = 'phoneNumber' OR pat.name = 'countryCode') AND pa.voided = false`,          
            (err, results, fields) => {
              if (err) reject(err);
              resolve(results);
            }
          );
        }).catch((err) => {
          throw err;
        });

        if (attributes.length) {
          for (const element of attributes) {
            if (element.attributeTypeName == Constant.PHONE_NUMBER) {
              phoneNumber = element.attributeValue
            }
            // if (element.attributeTypeName == Constant.COUNTRY_CODE) {
            //   countryCode = element.attributeValue
            // }
            if (element.attributeTypeName == Constant.EMAIL_ID) {
              email = element.attributeValue
            }
          }

          // If phoneNumber exists
          if (phoneNumber) {

          }
          // Send email here
          if (email) {
            await sendEmailSuccess(email, MESSAGE.AUTH.PASSWORD_RESET_SUCCESSFUL);
          }
        } else {
          return {
            code: 200,
            success: false,
            message: MESSAGE.AUTH.NO_PHONENUMBER_EMAIL_UPDATED_FOR_THIS_USERNAME,
            data: null
          }
        }


        return {
          code: 200,
          success: true,
          message: MESSAGE.AUTH.PASSWORD_RESET_SUCCESSFUL,
          data: null,
        };
      } else {
        return {
          code: 200,
          success: false,
          message: MESSAGE.COMMON.USER_NOT_EXIST,
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

  /**
  * Check if provider attribute value already exits or not
  * @param { string } attributeType - Provider attribute type
  * @param { string } attributeValue - Attribute value
  * @param { string } providerUuid - Provider uuid
  */
  const checkProviderAttribute = async function (
    attributeType,
    attributeValue,
    providerUuid
  ) {
    try {
      let provider_condition = "";
      if(providerUuid) provider_condition = `AND p.uuid != '${providerUuid}'`;
      let query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id WHERE pat.name = '${attributeType}' AND pa.value_reference = '${attributeValue}' AND p.retired = 0 AND pa.voided = false ${provider_condition}`;      let data = await new Promise((resolve, reject) => {
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
    requestOtp,
    verifyOtp,
    resetPassword,
    checkProviderAttribute
  };
})();
