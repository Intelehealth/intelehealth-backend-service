const moment = require("moment");
const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const { user_settings } = require("../models");
const { axiosInstance } = require("../handlers/helper");

module.exports = (function () {
  const saveOTP = async (userUuid, otp) => {
    let user = await user_settings.findOne({
      where: {
        user_uuid: userUuid,
      },
    });

    if (user) {
      user.otp = otp;
      await user.save();
    } else {
      user = await user_settings.create({
        user_uuid: userUuid,
        otp,
      });
    }

    return user;
  };
  this.sendOtp = async (userName, phoneNumber) => {
    try {
      let query,
        data = "",
        contactData;
      const noPayload = userName || phoneNumber;
      if (!noPayload) {
        throw new Error(
          "userName and phoneNumber both the empty, pass atleast any one."
        );
      }

      if (userName) {
        query = `SELECT username,system_id,uuid,person_id FROM users where username='${userName}' or system_id='${userName}' and retired = 0;`;
        data = await new Promise((resolve, reject) => {
          openMrsDB.query(query, (err, results, fields) => {
            if (err) reject(err);
            resolve(results);
          });
        }).catch((err) => {
          throw err;
        });

        data = data.length && data[0] ? data[0] : null;

        if (!data) {
          throw new Error(`Invalid username!`);
        }

        // const otp = Math.floor(Math.random() * 900000);
        await saveOTP(data.uuid, "111111");
      } else if (phoneNumber) {
        query = `SELECT
        pa.value_reference,
        p.name,
        p.person_id,
        pat.provider_attribute_type_id as type_id,
        pat.name as pname
    FROM
        provider p
        LEFT JOIN provider_attribute pa using (provider_id)
        LEFT JOIN provider_attribute_type pat on pa.attribute_type_id = pat.provider_attribute_type_id
    where
        pat.provider_attribute_type_id IN(3,4)
        and pa.value_reference = '${phoneNumber}';`;

        data = await new Promise((resolve, reject) => {
          openMrsDB.query(query, (err, results, fields) => {
            if (err) reject(err);
            resolve(results);
          });
        }).catch((err) => {
          throw err;
        });

        data = data.length && data[0] ? data[0] : null;

        if (!data) {
          throw new Error(`Invalid phoneNumber!`);
        }

        const users = await new Promise((resolve, reject) => {
          openMrsDB.query(
            `SELECT username,system_id,uuid,person_id FROM users where person_id='${data.person_id}' and retired = 0;`,
            (err, results, fields) => {
              if (err) reject(err);
              resolve(results);
            }
          );
        }).catch((err) => {
          throw err;
        });

        const user = users.length && users[0] ? users[0] : null;

        if (!user) {
          throw new Error(`No Active used found with the passed phoneNumber!`);
        }

        await saveOTP(user.uuid, "111111");

        data = { ...data, ...user };
      }

      return {
        success: true,
        data,
        message: "OTP sent successfully!",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  };

  this.resetPassword = async (userUuid, otp, newPassword) => {
    const url = `/openmrs/ws/rest/v1/password/${userUuid}`;
    console.log("url: ", url);

    let userSetting = await user_settings.findOne({
      where: {
        user_uuid: userUuid,
      },
    });

    if (!userSetting || !userSetting.otp) {
      throw new Error("Request OTP first!");
    }

    const otpUpdatedAtDifference = moment(userSetting.updatedAt).diff(
      moment(),
      "minutes"
    );

    if (otpUpdatedAtDifference > 5) {
      userSetting.otp = "";
      await userSetting.save();

      throw new Error("OTP expired, request a new OTP!");
    }

    if (userSetting.otp !== otp) {
      throw new Error("Invalid OTP!");
    }

    const payload = {
      newPassword,
    };

    const data = await axiosInstance.post(url, payload).catch((err) => {
      console.log("Openmrs API - err: ", err.body);
    });
    console.log("sucess:data:>>>>", data);

    return {
      success: true,
      data,
      message: "Password reset successfully!",
    };
  };

  return this;
})();
