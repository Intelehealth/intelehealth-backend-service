const openMrsDB = require("../../public/javascripts/mysql/mysqlOpenMrs");
const axios = require('axios');
const { user_settings } = require("../../models");
const { axiosInstance } = require("../../handlers/helper");
const moment = require("moment");

class AuthService {


    async saveOtp(userUuid, otp, otpFor) {
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
    }

    async requestOtp(email, phoneNumber, countryCode, username, otpFor) {
        try {
            let query, data;
            switch (otpFor) {
                case 'username':
                    query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND p.retired = 0 AND u.retired = 0`;
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
                                const otp = await axios.get(`https://2factor.in/API/V1/5025bb5d-b9b0-11ed-81b6-0200cd936042/SMS/+${countryCode}${phoneNumber}/AUTOGEN2`).catch(error => {
                                    throw new Error(error.message);
                                });
                                if (otp) {
                                    // Save OTP in database for verification
                                    await this.saveOtp(data[i].uuid, otp.data.OTP, 'U');
                                }
                            }

                            if (data[i].attributeTypeName == 'emailId') {
                                // Send email here
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
                    query = `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM users u LEFT JOIN provider p ON p.person_id = u.person_id WHERE u.username = '${username}' OR u.system_id = '${username}' AND p.retired = 0 AND u.retired = 0;`;
                    data = await new Promise((resolve, reject) => {
                        openMrsDB.query(query, (err, results, fields) => {
                          if (err) reject(err);
                          resolve(results);
                        });
                    }).catch((err) => {
                        throw err;
                    });
                    if (data.length) {
                        // Get phoneNumber and email of the user
                        const attributes = await new Promise((resolve, reject) => {
                            openMrsDB.query(
                              `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pat.provider_attribute_type_id = pa.attribute_type_id WHERE pa.provider_id = ${data[0].provider_id} AND (pat.name = 'emailId' OR pat.name = 'phoneNumber' OR pat.name = 'countryCode')`,
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
                                const otp = await axios.get(`https://2factor.in/API/V1/5025bb5d-b9b0-11ed-81b6-0200cd936042/SMS/+${countryCode}${phoneNumber}/AUTOGEN2`).catch(error => {
                                    throw new Error(error.message);
                                });
                                if (otp) {
                                    // Save OTP in database for verification
                                    await this.saveOtp(data[0].userUuid, otp.data.OTP, 'P');
                                }
                            } else if (email) {
                                // Send email here
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
                    query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND p.retired = 0 AND u.retired = 0`;
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
                                const otp = await axios.get(`https://2factor.in/API/V1/5025bb5d-b9b0-11ed-81b6-0200cd936042/SMS/+${countryCode}${phoneNumber}/AUTOGEN2`).catch(error => {
                                    throw new Error(error.message);
                                });
                                if (otp) {
                                    // Save OTP in database for verification
                                    await this.saveOtp(data[i].uuid, otp.data.OTP, 'A');
                                }
                            }

                            if (data[i].attributeTypeName == 'emailId') {
                                // Send email here
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
                    break;
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
        
    }

    async verfifyOtp(email, phoneNumber, username, verifyFor, otp) {
        try {
            let query, data, user;
            switch (verifyFor) {
                case 'username':
                    query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND p.retired = 0 AND u.retired = 0`;
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
                                  otpFor: 'U'
                                },
                            }); 
                            if (user) {
                                break;
                            }
                        }

                        if (user) {
                            if (moment(user.updatedAt).diff(moment(), "minutes") < 5) {
                                // Send username here

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
                    query = `SELECT u.username, u.system_id, u.uuid AS userUuid, p.uuid AS providerUuid, u.person_id, p.provider_id FROM users u LEFT JOIN provider p ON p.person_id = u.person_id WHERE u.username = '${username}' OR u.system_id = '${username}' AND p.retired = 0 AND u.retired = 0;`;
                    data = await new Promise((resolve, reject) => {
                        openMrsDB.query(query, (err, results, fields) => {
                          if (err) reject(err);
                          resolve(results);
                        });
                    }).catch((err) => {
                        throw err;
                    });
                    if (data.length) {
                        let user = await user_settings.findOne({
                            where: {
                              user_uuid: data[0].userUuid,
                              otp: otp,
                              otpFor: 'P'
                            },
                        });
                        if (user) {
                            if (moment(user.updatedAt).diff(moment(), "minutes") < 5) {
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
                    query = `SELECT pa.value_reference AS attributeValue, pat.name AS attributeTypeName, p.provider_id, p.person_id, u.username, u.uuid FROM provider_attribute pa LEFT JOIN provider_attribute_type pat ON pa.attribute_type_id = pat.provider_attribute_type_id LEFT JOIN provider p ON p.provider_id = pa.provider_id LEFT JOIN users u ON u.person_id = p.person_id WHERE (pat.name = 'emailId' OR pat.name = 'phoneNumber') AND pa.value_reference = '${ (phoneNumber) ? phoneNumber : email }' AND p.retired = 0 AND u.retired = 0`;
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
                            if (moment(user.updatedAt).diff(moment(), "minutes") < 5) {
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
    }

    async resetPassword(userUuid, newPassword) {
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
                    newPassword
                };
                const data = await axiosInstance.post(url, payload).catch((err) => {
                    console.log("Openmrs API - err: ", err.body);
                });
                return {
                    code: 200,
                    success: true,
                    message: "Password reset successful.",
                    data: data
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
    }
}

module.exports = {
    authService: function () {
      return new AuthService();
    },
};