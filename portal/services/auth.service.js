const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const axios = require('axios');
const { user_settings } = require("../models");
const { axiosInstance } = require("../handlers/helper");
const functions = require("../handlers/functions");
const moment = require("moment");
const otpGenerator = require('otp-generator');
const fs = require('fs');

module.exports = (function () {
    this.saveOtp = async function (userUuid, otp, otpFor) {
        let user = await user_settings.findOne({
            where: {
              user_uuid: userUuid,
            },
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

    this.requestOtp = async function (email, phoneNumber, countryCode, username, otpFor) {
        try {
            let query, data;            
            switch (otpFor) {
                case 'username':
                    query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
                    data = await new Promise((resolve, reject) => {
                        openMrsDB.query(query, (err, results, fields) => {
                          if (err) reject(err);
                          resolve(results);
                        });
                    }).catch((err) => {
                        throw err;
                    });
                    if (data.length) {
                        for (let i = 0; i < data.length; i++) {
                            if (data[i].attributeTypeName == 'phoneNumber') {
                                // Make send OTP request
                                const otp = await axios.get(`https://2factor.in/API/V1/${process.env.APIKEY_2FACTOR}/SMS/+${countryCode}${phoneNumber}/AUTOGEN2`).catch(error => {
                                    throw new Error(error.message);
                                });
                                if (otp) {
                                    // Save OTP in database for verification
                                    await this.saveOtp(data[i].uuid, otp.data.OTP, 'U');
                                }
                            }

                            if (data[i].attributeTypeName == 'emailId') {
                                // Send email here
                                const randomOtp = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
                                let otpTemplate = fs.readFileSync('./common/emailtemplates/otpTemplate.html', 'utf8').toString();
                                otpTemplate = otpTemplate.replace('$otpFor', 'forgot username').replace('$otp', randomOtp);
                                const mail = await functions.sendEmail(email, "Verification code for forgot username", otpTemplate).catch((error) =>  { throw error });
                                // const mail = functions.sendEmail(email, "OTP for forgot username", `${randomOtp} is your otp for forgot username verification at Intelehealth application.`).catch((error) =>  { throw error });
                                if (mail.messageId) {
                                    // Save OTP in database for verification
                                    await this.saveOtp(data[i].uuid, randomOtp, 'U');
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
                        return {
                            code: 200,
                            success: false,
                            message: "No user exists with this phone number/email.",
                            data: null
                        }
                    }
                    break;

                case 'password':
                    if (username) {
                        query = `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM users u LEFT JOIN provider p ON p.person_id = u.person_id WHERE u.username = '${username}' OR u.system_id = '${username}' AND p.retired = 0 AND u.retired = 0;`;
                        data = await new Promise((resolve, reject) => {
                            openMrsDB.query(query, (err, results, fields) => {
                              if (err) reject(err);
                              resolve(results);
                            });
                        }).catch((err) => {
                            throw err;
                        });
                    } else if (phoneNumber || email) {
                        query = `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
                        data = await new Promise((resolve, reject) => {
                            openMrsDB.query(query, (err, results, fields) => {
                            if (err) reject(err);
                            resolve(results);
                            });
                        }).catch((err) => {
                            throw err;
                        });
                    }

                    if (data.length) {
                        // Get phoneNumber and email of the user
                        const attributes = await new Promise((resolve, reject) => {
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
                            for (let i = 0; i < attributes.length; i++) {
                                if (attributes[i].attributeTypeName == 'phoneNumber') {
                                    phoneNumber = attributes[i].attributeValue
                                }
                                if (attributes[i].attributeTypeName == 'countryCode') {
                                    countryCode = attributes[i].attributeValue
                                }
                                if (attributes[i].attributeTypeName == 'emailId') {
                                    email = attributes[i].attributeValue
                                }
                            }

                            // If phoneNumber and countryCode exists
                            if (phoneNumber && countryCode) {
                                // Make request
                                const otp = await axios.get(`https://2factor.in/API/V1/${process.env.APIKEY_2FACTOR}/SMS/+${countryCode}${phoneNumber}/AUTOGEN2`).catch(error => {
                                    throw new Error(error.message);
                                });
                                if (otp) {
                                    // Save OTP in database for verification
                                    await this.saveOtp(data[0].userUuid, otp.data.OTP, 'P');

                                    if (email) {
                                        let otpTemplate = fs.readFileSync('./common/emailtemplates/otpTemplate.html', 'utf8').toString();
                                        otpTemplate = otpTemplate.replace('$otpFor', 'forgot password').replace('$otp', otp.data.OTP);
                                        const mail = await functions.sendEmail(email, "Verification code for forgot password", otpTemplate).catch((error) =>  { throw error });
                                        // const mail = functions.sendEmail(email, "OTP for forgot password", `${otp.data.OTP} is your otp for forgot password verification at Intelehealth application.`).catch((error) =>  { throw error });
                                    }
                                }
                            } else if (email) {
                                // Send email here
                                const randomOtp = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
                                let otpTemplate = fs.readFileSync('./common/emailTemplates/otpTemplate.html', 'utf8').toString();
                                otpTemplate = otpTemplate.replace('$otpFor', 'forgot password').replace('$otp', randomOtp);
                                const mail = await functions.sendEmail(email, "Verification code for forgot password", otpTemplate).catch((error) =>  { throw error });
                                // const mail = functions.sendEmail(email, "OTP for forgot password", `${randomOtp} is your otp for forgot password verification at Intelehealth application.`).catch((error) =>  { throw error });
                                if (mail.messageId) {
                                    // Save OTP in database for verification
                                    await this.saveOtp(data[i].uuid, randomOtp, 'U');
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
                    } else {
                        return {
                            code: 200,
                            success: false,
                            message: "No user exists with this username.",
                            data: null
                        }
                    }
                    break;

                case 'verification':
                    query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND (u.username = '${username}' OR u.system_id = '${username}') AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
                    data = await new Promise((resolve, reject) => {
                        openMrsDB.query(query, (err, results, fields) => {
                          if (err) reject(err);
                          resolve(results);
                        });
                    }).catch((err) => {
                        throw err;
                    });
                    if (data.length) {
                        for (let i = 0; i < data.length; i++) {
                            if (data[i].attributeTypeName == 'phoneNumber') {
                                // Make send OTP request
                                const otp = await axios.get(`https://2factor.in/API/V1/${process.env.APIKEY_2FACTOR}/SMS/+${countryCode}${phoneNumber}/AUTOGEN2`).catch(error => {
                                    throw new Error(error.message);
                                });
                                if (otp) {
                                    // Save OTP in database for verification
                                    await this.saveOtp(data[i].uuid, otp.data.OTP, 'A');
                                }
                            }

                            if (data[i].attributeTypeName == 'emailId') {
                                // Send email here
                                const randomOtp = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
                                let otpTemplate = fs.readFileSync('./common/emailtemplates/otpTemplate.html', 'utf8').toString();
                                otpTemplate = otpTemplate.replace('$otpFor', 'sign in').replace('$otp', randomOtp);
                                const mail = await functions.sendEmail(email, "Verification code for sign in", otpTemplate).catch((error) =>  { throw error });
                                // const mail = functions.sendEmail(email, "OTP for verification", `${randomOtp} is your otp for verification at Intelehealth application.`).catch((error) =>  { throw error });
                                if (mail.messageId) {
                                    // Save OTP in database for verification
                                    await this.saveOtp(data[i].uuid, randomOtp, 'A');
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
                        return {
                            code: 200,
                            success: false,
                            message: "No user exists with this phone number/email.",
                            data: null
                        }
                    }
                    break;

                default:
                    return {
                        code: 400,
                        success: false,
                        message: "Bad request! Invalid arguments.",
                        data: null
                    }
                    break;
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
        
    };

    this.verfifyOtp = async function (email, phoneNumber, username, verifyFor, otp) {
        try {
            let query, data, user;
            switch (verifyFor) {
                case 'username':
                    query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
                    data = await new Promise((resolve, reject) => {
                        openMrsDB.query(query, (err, results, fields) => {
                          if (err) reject(err);
                          resolve(results);
                        });
                    }).catch((err) => {
                        throw err;
                    });
                    if (data.length) {
                        let user, index;
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
                            if (moment().diff(moment(user.updatedAt), "minutes") < 1) {
                                // Send username here
                                if (phoneNumber) {
                                    // const body = new URLSearchParams();
                                    // body.append('module', 'TRANS_SMS');
                                    // body.append('apikey', process.env.APIKEY_2FACTOR);
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
                                    let usernameTemplate = fs.readFileSync('./common/emailtemplates/usernameTemplate.html', 'utf8').toString();
                                    usernameTemplate = usernameTemplate.replace('$username', data[index].username);
                                    const mail = await functions.sendEmail(email, "Your account credentials at Intelehealth", usernameTemplate).catch((error) =>  { throw error });
                                    if (mail.messageId) {
                                        
                                    }
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
                    } else {
                        return {
                            code: 200,
                            success: false,
                            message: "No user exists with this phone number/email.",
                            data: null
                        }
                    }
                    break;

                case 'password':
                    if (username) {
                        query = `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM users u LEFT JOIN provider p ON p.person_id = u.person_id WHERE u.username = '${username}' OR u.system_id = '${username}' AND p.retired = 0 AND u.retired = 0;`;
                        data = await new Promise((resolve, reject) => {
                            openMrsDB.query(query, (err, results, fields) => {
                              if (err) reject(err);
                              resolve(results);
                            });
                        }).catch((err) => {
                            throw err;
                        });
                    } else if (phoneNumber || email) {
                        query = `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
                        data = await new Promise((resolve, reject) => {
                            openMrsDB.query(query, (err, results, fields) => {
                            if (err) reject(err);
                            resolve(results);
                            });
                        }).catch((err) => {
                            throw err;
                        });
                    }

                    if (data.length) {
                        let user = await user_settings.findOne({
                            where: {
                              user_uuid: data[0].userUuid,
                              otp: otp,
                              otpFor: 'P'
                            },
                        });
                        if (user) {
                            if (moment().diff(moment(user.updatedAt), "minutes") < 1) {
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
                    } else {
                        return {
                            code: 200,
                            success: false,
                            message: "No user exists with this username.",
                            data: null
                        }
                    }
                    break;

                case 'verification':
                    query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND (u.username = '${username}' OR u.system_id = '${username}') AND p.retired = 0 AND u.retired = 0 AND pa.voided = false`;
                    data = await new Promise((resolve, reject) => {
                        openMrsDB.query(query, (err, results, fields) => {
                          if (err) reject(err);
                          resolve(results);
                        });
                    }).catch((err) => {
                        throw err;
                    });
                    if (data.length) {
                        let user;
                        for (let i = 0; i < data.length; i++) {
                            user = await user_settings.findOne({
                                where: {
                                  user_uuid: data[i].uuid,
                                  otp: otp,
                                  otpFor: 'A'
                                },
                            }); 
                            if (user) {
                                break;
                            }
                        }

                        if (user) {
                            if (moment().diff(moment(user.updatedAt), "minutes") < 1) {
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
                    } else {
                        return {
                            code: 200,
                            success: false,
                            message: "No user exists with this phone number/email.",
                            data: null
                        }
                    }
                    break;

                default:
                    break;
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.resetPassword = async function (userUuid, newPassword) {
        try {
            const url = `/openmrs/ws/rest/v1/password/${userUuid}`;
            let user = await user_settings.findOne({
                where: {
                user_uuid: userUuid,
                otpFor: 'P'
                },
            });
        
            if (user) {
                const payload = {
                    newPassword,
                };
                const data = await axiosInstance.post(url, payload).catch((err) => {
                    console.log("Openmrs API - err: ", err.body);
                });
                return {
                    code: 200,
                    success: true,
                    message: "Password reset successful.",
                    data: null
                };
            } else {
                return {
                    code: 200,
                    success: false,
                    message: "No user exists!",
                    data: null
                }
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.checkProviderAttribute = async function (attributeType, attributeValue, providerUuid) {
        try {
            let query, data;
            query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id WHERE pat.name = '${ attributeType }' AND pa.value_reference = '${ attributeValue }' AND p.retired = 0 AND pa.voided = false AND p.uuid != '${providerUuid}'`;
            data = await new Promise((resolve, reject) => {
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
                    data: false
                };
            } else {
                return {
                    code: 200,
                    success: true,
                    message: `${attributeType.toUpperCase()} does not exists!`,
                    data: true
                };
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    return this;
})();