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
  this.sendOtp = async (userName, email) => {
    try {
      let query,
        data = "";
      const noPayload = userName || email;
      if (!noPayload) {
        throw new Error(
          "userName and email both the empty, pass atleast any one."
        );
      }

      if (userName) {
        query = `SELECT username,system_id,uuid,person_id FROM openmrs.users where username='${userName}' or system_id='${userName}';`;
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
        console.log("data: ", data);

        // const otp = Math.floor(Math.random() * 900000);
        await saveOTP(data.uuid, "1111");
      } else if (email) {
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
        pat.provider_attribute_type_id = 3
        and pa.value_reference = '${email}';`;

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
          throw new Error(`Invalid email!`);
        }
      }

      return {
        success: true,
        data,
        message: "OTP sent successfully!",
      };
    } catch (error) {
      console.log("error: sendMessage ", error);
      return {
        success: false,
        message: error.message,
      };
    }
  };

  this.resetPassword = async (userUuid, otp, newPassword) => {
    const url = `/openmrs/ws/rest/v1/password/${userUuid}`;

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

    const data = await axiosInstance.post(url, payload).catch((err) => {});

    return {
      success: true,
      data,
      message: "Password reset successfully!",
    };
  };

  return this;
})();
