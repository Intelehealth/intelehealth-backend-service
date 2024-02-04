const moment = require("moment");
const openMrsDB = require("../handlers/mysql/mysqlOpenMrs");
const { user_settings, appointments: Appointment } = require("../models");
const { axiosInstance } = require("../handlers/helper");
const { QueryTypes } = require("sequelize");
const { getVisitCountV3 } = require("../controllers/queries");
const {
  visit,
  encounter,
  patient_identifier,
  person_name,
  encounter_type,
  encounter_provider,
  person,
  provider,
  location,
  visit_attribute,
  obs,
  Sequelize,
  sequelize,
  concept,
  concept_name
} = require("../openmrs_models");
const { MESSAGE } = require("../constants/messages");
const Constant = require("../constants/constant");
const Op = Sequelize.Op;

module.exports = (function () {
  /**
  * Save OTP to database
  * @param { string } userUuid - User uuid
  * @param { number } otp - OTP
  */
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

  /**
  * Send otp
  * @param { string } userName - Username
  * @param { string } phoneNumber - Phone number
  */
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
          throw new Error(MESSAGE.OPENMRS.INVALID_USERNAME);
        }

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
          throw new Error(MESSAGE.OPENMRS.INVALID_PHONENUMBER);
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
          throw new Error(MESSAGE.OPENMRS.NO_ACTIVE_USED_FOUND_WITH_THE_PASSED_PHONENUMBER);
        }

        await saveOTP(user.uuid, "111111");

        data = { ...data, ...user };
      }

      return {
        success: true,
        data,
        message: MESSAGE.OPENMRS.OTP_SENT_SUCCESSFULLY,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  };

  /**
  * Reset openmrs password
  * @param { string } userUuid - User uuid
  * @param { number } otp - OTP
  * @param { string } newPassword - New password
  */
  this.resetPassword = async (userUuid, otp, newPassword) => {
    const url = `/openmrs/ws/rest/v1/password/${userUuid}`;

    let userSetting = await user_settings.findOne({
      where: {
        user_uuid: userUuid,
      },
    });

    if (!userSetting || !userSetting.otp) {
      throw new Error(MESSAGE.OPENMRS.REQUEST_OTP_FIRST);
    }

    const otpUpdatedAtDifference = moment(userSetting.updatedAt).diff(
      moment(),
      "minutes"
    );

    if (otpUpdatedAtDifference > 5) {
      userSetting.otp = "";
      await userSetting.save();

      throw new Error(MESSAGE.OPENMRS.OTP_EXPIRED_REQUEST_A_NEW_OTP);
    }

    if (userSetting.otp !== otp) {
      throw new Error(MESSAGE.OPENMRS.INVALID_OTP);
    }

    const payload = {
      newPassword,
    };

    const data = await axiosInstance.post(url, payload).catch((err) => {
    });

    return {
      success: true,
      data,
      message: MESSAGE.OPENMRS.PASSWORD_RESET_SUCCESSFULLY,
    };
  };

  /**
  * Get visits
  * @param { string } type - Visit type
  * @param { string } speciality - Doctor speciality
  */
  this.getVisits = async (type, speciality) => {
    if (!type) {
      return [];
    } else {
      const visits = await sequelize.query(getVisitCountV3(), {
        type: QueryTypes.SELECT,
      });
      let appointmentVisitIds = [];
      if(type === "Awaiting Consult"){
        const data = await Appointment.findAll({
          attributes: [Constant.VISIT_UUID],
          where: {
            speciality: speciality,
            status: Constant.BOOKED,
          },
          raw: true,
        });
        appointmentVisitIds = data.map(i=>i.visitUuid);
      }
      return Array.isArray(visits)
        ? visits.filter((v) => v?.Status === type && v.speciality == speciality && !appointmentVisitIds.includes(v.uuid)).map((v) => v?.visit_id)
        : [];
    }
  };
  
  /**
   * Encounter type
   * 1 - ADULTINITIAL
   * 6 - Vitals
   * 9 - Visit Note
   * 12 - Patient Exit Survey
   * 14 - Visit Complete
   * 15 - Flagged
   */
  /**
  * Get visits by type
  * @param { string } speciality - Doctor speciality
  * @param { number } page - Page number
  * @param { number } limit - Limit
  * @param { string } type - Visit type
  */
  this.getVisitsByType = async (
    speciality,
    page = 1,
    limit = 1000,
    type
  ) => {
    try {
      let offset = limit * (Number(page) - 1);

      if (limit > 5000) limit = 5000;
      const visitIds = await this.getVisits(type, speciality);

      const visits = await visit.findAll({
        where: {
          visit_id: { [Op.in]: visitIds },
        },
        attributes: ["uuid","date_stopped","date_created"],
        include: [
          {
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime"],
            include: [
              {
                model: obs,
                as: "obs",
                attributes: ["value_text", "concept_id", "value_numeric"]
              },
              {
                model: encounter_type,
                as: "type",
                attributes: ["name"],
              },
              {
                model: encounter_provider,
                as: "encounter_provider",
                attributes: ["uuid"],
                include: [
                  {
                    model: provider,
                    as: "provider",
                    attributes: ["identifier", "uuid"],
                    include: [
                      {
                        model: person,
                        as: "person",
                        attributes: ["gender"],
                        include: [
                          {
                            model: person_name,
                            as: "person_name",
                            attributes: ["given_name", "family_name", "middle_name"],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            model: patient_identifier,
            as: "patient",
            attributes: ["identifier"],
          },
          {
            model: person_name,
            as: "patient_name",
            attributes: ["given_name", "family_name", "middle_name"],
          },
          {
            model: person,
            as: "person",
            attributes: ["uuid", "gender", "birthdate"],
          },
          {
            model: location,
            as: "location",
            attributes: ["name"],
          },
        ],
        order: [["visit_id", "DESC"]],
        limit,
        offset,
      });

      return {  totalCount: visitIds.length, currentCount: visits.length, visits: visits};
    } catch (error) {
      throw error;
    }
  };

  /**
  * Get priority visits
  * @param { string } speciality - Doctor speciality
  * @param { number } page - Page number
  * @param { number } limit - Limit
  */
  this._getPriorityVisits = async (
    speciality,
    page = 1,
    limit = 1000
  ) => {
    try {
      return await getVisitsByType(
        speciality, 
        page, 
        limit, 
        "Priority");
    } catch (error) {
      throw error;
    }
  };

  /**
  * Get awaiting visits
  * @param { string } speciality - Doctor speciality
  * @param { number } page - Page number
  * @param { number } limit - Limit
  */
  this._getAwaitingVisits = async (
    speciality,
    page = 1,
    limit = 1000
  ) => {
    try {
      return await getVisitsByType(
        speciality,
        page,
        limit,
        "Awaiting Consult"
      );
    } catch (error) {
      throw error;
    }
  };

  /**
  * Get inprogress visits
  * @param { string } speciality - Doctor speciality
  * @param { number } page - Page number
  * @param { number } limit - Limit
  */
  this._getInProgressVisits = async (
    speciality,
    page = 1,
    limit = 1000
  ) => {
    try {
      return await getVisitsByType(
        speciality,
        page,
        limit,
        "Visit In Progress"
      );
    } catch (error) {
      throw error;
    }
  };

  /**
  * Get completed visits
  * @param { string } speciality - Doctor speciality
  * @param { number } page - Page number
  * @param { number } limit - Limit
  */
  this._getCompletedVisits = async (
    speciality,
    page = 1,
    limit = 1000
  ) => {
    try {
      return await getVisitsByType(
        speciality,
        page,
        limit,
        "Completed Visit"
      );
    } catch (error) {
      throw error;
    }
  };

  /**
  * Get ended visits
  * @param { string } speciality - Doctor speciality
  * @param { number } page - Page number
  * @param { number } limit - Limit
  */
  this._getEndedVisits = async (
    speciality,
    page = 1,
    limit = 1000
  ) => {
    try {
      return await getVisitsByType(
        speciality,
        page,
        limit,
        "Ended Visit"
      );
    } catch (error) {
      throw error;
    }
  };

  return this;
})();
