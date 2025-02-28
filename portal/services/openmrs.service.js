const moment = require("moment");
const openMrsDB = require("../handlers/mysql/mysqlOpenMrs");
const { user_settings, appointments: Appointment } = require("../models");
const { axiosInstance } = require("../handlers/helper");
const { QueryTypes } = require("sequelize");
const { getVisitCountV3,getVisitsByDoctorId } = require("../controllers/queries");
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
const { logStream } = require("../logger/index");
const Constant = require("../constants/constant");
const Op = Sequelize.Op;

module.exports = (function () {
  /**
  * Save OTP to database
  * @param { string } userUuid - User uuid
  * @param { number } otp - OTP
  */
  const saveOTP = async (userUuid, otp) => {
    logStream('debug','Openmrs Service', 'Save Otp');
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
    logStream('debug','Success', 'Save Otp');
    return user;
  };

  /**
  * Send otp
  * @param { string } userName - Username
  * @param { string } phoneNumber - Phone number
  */
  this.sendOtp = async (userName, phoneNumber) => {
    try {
      logStream('debug','Openmrs Service', 'send Otp');
      let query,
        data = "",
        contactData;
      const noPayload = userName || phoneNumber;
      if (!noPayload) {
        logStream("error", 'Invalid Arguments!');     
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
          logStream("error", 'Invalid username!');     
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
          logStream("error", err.message);
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
          logStream("error", err.message);
          throw err;
        });

        const user = users.length && users[0] ? users[0] : null;

        if (!user) {
          throw new Error(MESSAGE.OPENMRS.NO_ACTIVE_USED_FOUND_WITH_THE_PASSED_PHONENUMBER);
        }

        await saveOTP(user.uuid, "111111");

        data = { ...data, ...user };
      }
      logStream('debug','Success', 'send Otp');
      return {
        success: true,
        data,
        message: MESSAGE.OPENMRS.OTP_SENT_SUCCESSFULLY,
      };
    } catch (error) {
      logStream("error", error.message);
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

    logStream('debug','Openmrs Service', 'Reset Password');
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
      logStream("error","")
      throw new Error(MESSAGE.OPENMRS.INVALID_OTP);
    }

    const payload = {
      newPassword,
    };

    const data = await axiosInstance.post(url, payload).catch((err) => {
    });
    logStream('debug','Openmrs Service', 'Reset Password');
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
    logStream('debug','Openmrs Service', 'Get Visits');
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
      if( type === "Ended Visit") {
        return Array.isArray(visits)
        ? visits.filter((v) => (v?.Status === "Ended Visit" || v?.Status === "Completed Visit") && v.speciality == speciality && !appointmentVisitIds.includes(v.uuid)).map((v) => v?.visit_id)
        : [];
      } else {
        return Array.isArray(visits)
        ? visits.filter((v) => v?.Status === type && v.speciality == speciality && !appointmentVisitIds.includes(v.uuid)).map((v) => v?.visit_id)
        : [];
      } 
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
      logStream('debug','Openmrs Service', 'Get Visits By Type');
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
      logStream("error", error.message);
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
      logStream('debug','Openmrs Service', 'Get Priority Visits');
      return await getVisitsByType(
        speciality, 
        page, 
        limit, 
        "Priority");
    } catch (error) {
      logStream("error", error.message);
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
      logStream('debug','Openmrs Service', 'Get Awaiting Visits');
      return await getVisitsByType(
        speciality,
        page,
        limit,
        "Awaiting Consult"
      );
    } catch (error) {
      logStream("error", error.message);
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
      logStream('debug','Openmrs Service', 'Get In Progress Visits');
      return await getVisitsByType(
        speciality,
        page,
        limit,
        "Visit In Progress"
      );
    } catch (error) {
      logStream("error", error.message);
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
      logStream('debug','Openmrs Service', 'Get Completed Visits');
      return await getVisitsByType(
        speciality,
        page,
        limit,
        "Completed Visit"
      );
    } catch (error) {
      logStream("error", error.message);
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
      logStream('debug','Openmrs Service', 'Get Ended Visits');
      return await getVisitsByType(
        speciality,
        page,
        limit,
        "Ended Visit"
      );
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

    /**
  * Update location attributes
  * @param { string } locationId - location Id
  * @param { Object } dataToUpdate - dataToUpdate
  */
  this._updateLocationAttributes   = async (locationId, dataToUpdate) => {
    let response;
      for (let key of dataToUpdate) {
        if(key.secondaryVillageId) {
          response = await axiosInstance.get(
            `/openmrs/ws/rest/v1/location/${key.secondaryVillageId}/attribute`
          );
          await saveLocationAttributes(response, key, key.secondaryVillageId);
        } else {
           response = await axiosInstance.get(
            `/openmrs/ws/rest/v1/location/${locationId}/attribute`
          );
          await saveLocationAttributes(response, key, locationId);
        }
      }
      let updatedRes = await axiosInstance.get(
        `/openmrs/ws/rest/v1/location/${locationId}/attribute`
      );
      return (updatedRes.data.results);
  };

   this.saveLocationAttributes= async (response, key, locationId) => {
    let attr = response.data.results.find((a) => a.attributeType.uuid === key.attributeType);
    if (attr) {
      //update
      const payload = {
        attributeType: attr.attributeType.uuid,
        value: key.value,
      };
      const url = `/openmrs/ws/rest/v1/location/${locationId}/attribute/${attr.uuid}`;
      await axiosInstance.post(url, payload).catch((err) => { });
    } else {
      //create
      const payload = {
        attributeType: key.attributeType,
        value: key.value,
      };
      const url = `/openmrs/ws/rest/v1/location/${locationId}/attribute`;
      await axiosInstance.post(url, payload).catch((err) => { });
    }
  };

    /**
  * Get location 
  * @param data - location data
  */
  this._setLocationTree = (data) => {
    let states = data.filter((d) => d.tag === "State");
    if (states.length) {
      states = states.map((s) => {
        let districts = data.filter(
          (d) => d.parent === s.id && d.tag === "District"
        );
        if (districts.length) {
          districts = districts.map((d) => {
            let child = {};
            const sanchs = data.filter(
              (s) => s.parent === d.id && s.tag === "Sanch"
            );
            const tehsils = data.filter(
              (t) => t.parent === d.id && t.tag === "Tehsil"
            );
            if (sanchs.length) {
              child.sanchs = sanchs.map((s) => {
                const villages = data
                  .filter((v) => v.parent === s.id && v.tag === "Village")
                  .map(({ name, uuid, id }) => ({ name, uuid, id }));

                return { name: s.name, uuid: s.uuid, id: s.id, villages };
              });
            } else if (tehsils.length) {
              child.tehsils = tehsils.map((t) => {
                const villages = data
                  .filter((v) => v.parent === t.id && v.tag === "Village")
                  .map(({ name, uuid, id }) => ({ name, uuid, id }));

                return { name: s.name, uuid: s.uuid, id: s.id, villages };
              });
            } else {
              child.villages = data
                .filter((v) => v.parent === d.id && v.tag === "Village")
                .map(({ name, uuid, id }) => ({ name, uuid, id }));
            }
            return {
              name: d.name,
              uuid: d.uuid,
              id: d.id,
              ...child,
            };
          });
        }

        return {
          name: s.name,
          id: s.id,
          uuid: s.uuid,
          districts,
        };
      });
    }

    return states;
  };

    /**
  * Get visits by type
  * @param { string } userId - Doctor userId
  * @param { number } page - Page number
  * @param { number } limit - Limit
  */
    this._getDoctorsVisit = async (
      userId,
      page = 1,
      limit = 1000
    ) => {
      try {
        logStream('debug','Openmrs Service', 'Get visit completed by doctor');
        let offset = limit * (Number(page) - 1);
        if (limit > 5000) limit = 5000;
        const visitIds = await sequelize.query(getVisitsByDoctorId(userId),{raw: true, type: QueryTypes.SELECT});
        const visitIdArray = Array.isArray(visitIds)
        ? visitIds.map(v => v?.visit_id)
        : [];
        const visits = await visit.findAll({
          where: {
            visit_id: { [Op.in]:   visitIdArray,
           },
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
        logStream("error", error.message);
        throw error;
      }
    };

  return this;
})();
