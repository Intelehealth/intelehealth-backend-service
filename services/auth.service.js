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
      subject,
      replacedTemplate
    ).catch((error) => { throw error });
  };

  const sendEmailUsername = async function (email, subject, username) {
    const otpTemplate = fs
      .readFileSync("./common/emailtemplates/usernameTemplate.html", "utf8")
      .toString();

    const replacedTemplate = otpTemplate
      .replace("$username", username);

    await functions.sendEmail(
      email,
      subject,
      replacedTemplate
    ).catch((error) => { throw error });
  };

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

  const requestOtp = async function (email, phoneNumber, countryCode, username, otpFor) {
    try {
      let attributes;
      if (!["username","password","verificaton"].includes(otpFor)) {
        return {
          code: 400,
          success: false,
          message: "Bad request! Invalid arguments.",
          data: null
        }
      }

      const data = await getUserData(phoneNumber, email, username, otpFor);
      if (data.length) {
        if (otpFor === "username" || otpFor === "verification") {
          for (const element of data) {
            if (element.attributeTypeName == "phoneNumber") {
              // Make send OTP request
              const otp = await getOtpFrom2Factor(`+${countryCode}${phoneNumber}`).catch(error => {
                throw new Error(error.message);
              });
              if (otp) {
                // Save OTP in database for verification
                await this.saveOtp(element.uuid, otp.data.OTP, otpFor === "username" ? "U" : "A");
              }
            }

            if (element.attributeTypeName == "emailId") {
              // Send email here
              const randomOtp = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
              const mail = await sendEmailOtp(email, otpFor === "username" ? "Verification code for forgot username" : "Verification code for sign in", randomOtp);
              if (mail.messageId) {
                // Save OTP in database for verification
                await this.saveOtp(element.uuid, randomOtp, otpFor === "username" ? "U" : "A");
              }
            }
          }
          return {
            code: 200,
            success: true,
            message: "Otp sent successfully!",
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
              if (element.attributeTypeName == "phoneNumber") {
                phoneNumber = element.attributeValue
              }
              if (element.attributeTypeName == "countryCode") {
                countryCode = element.attributeValue
              }
              if (element.attributeTypeName == "emailId") {
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
                await this.saveOtp(data[0].userUuid, otp.data.OTP, "P");
                if (email) {
                  await sendEmailOtp(email, "Verification code for forgot password", otp.data.OTP);  
                }
              }
            } else if (email) {
              // Send email here
              const randomOtp = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
              const mail = await sendEmailOtp(email, "Verification code for forgot password", randomOtp);
              if (mail.messageId) {
                // Save OTP in database for verification
                await this.saveOtp(data[i].uuid, randomOtp, "P");
              }
            }

            return {
              code: 200,
              success: true,
              message: "Otp sent successfully!",
              data: {
                userUuid: data[0].userUuid,
                providerUuid: data[0].providerUuid
              }
            }
          } else {
            return {
              code: 200,
              success: false,
              message: "No phoneNumber/email updated for this username.",
              data: null
            }
          }
        }
      } else {
        return {
          code: 200,
          success: false,
          message: "No user exists with this phone number/email/username.",
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

  const verifyOtp = async function (email, phoneNumber, username, verifyFor, otp) {
    try {
      let user, index;

      if (!["username","password","verificaton"].includes(verifyFor)) {
        return {
          code: 400,
          success: false,
          message: "Bad request! Invalid arguments.",
          data: null
        }
      }

      const data = await getUserData(phoneNumber, email, username, verifyFor);

      if (data.length) {
        switch (verifyFor) {
          case "username":
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
                // Send username here
                if (phoneNumber) {
                  // const body = new URLSearchParams();
                  // body.append('module', 'TRANS_SMS');
                  // body.append('apikey', config[env].apiKey2Factor);
                  // body.append('to', `+${countryCode}${phoneNumber}`);
                  // body.append('from', 'HEADER');
                  // body.append('msg', `Welcome to Intelehealth. Please use the username ${data[index].username} to sign in at Intelehealth.`);
                  // body.append('from', 'HEADER');
                  // const otp = await axios.post(`https://2factor.in/API/R1/`, body, {
                  //     headers: { 
                  //       "Content-Type": "application/x-www-form-urlencoded"
                  //     }
                  // }).catch(error => {
                  //     throw new Error(error.message);
                  // });
                  // if (otp) {

                  // }
                }

                if (email) {
                  await sendEmailUsername(email, "Your account credentials at Intelehealth", data[index].username);
                }
                return {
                  code: 200,
                  success: true,
                  message: "Otp verified successfully!",
                  data: null
                };
              } else {
                return {
                  code: 200,
                  success: false,
                  message: "Otp expired!",
                  data: null
                };
              }
            } else {
              return {
                code: 200,
                success: false,
                message: "Otp incorrect!",
                data: null
              };
            }

          case "password":
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
                  message: "Otp verified successfully!",
                  data: {
                    userUuid: data[0].userUuid,
                    providerUuid: data[0].providerUuid
                  }
                };
              } else {
                return {
                  code: 200,
                  success: false,
                  message: "Otp expired!",
                  data: null
                };
              }
            } else {
              return {
                code: 200,
                success: false,
                message: "Otp incorrect!",
                data: null
              };
            }

          case "verification":
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
                  message: "Otp verified successfully!",
                  data: null
                };
              } else {
                return {
                  code: 200,
                  success: false,
                  message: "Otp expired!",
                  data: null
                };
              }
            } else {
              return {
                code: 200,
                success: false,
                message: "Otp incorrect!",
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
          message: "No user exists with this phone number/email/username.",
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
    requestOtp,
    verifyOtp,
    resetPassword,
    checkProviderAttribute
  };
})();
