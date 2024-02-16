const { user_status, active_session } = require("../models");
const { axiosInstance, log } = require("../handlers/helper");

const moment = require("moment");

module.exports = (function () {
  this.TIME_FORMAT = "[H]h [M]m";
  const HEARTBEAT_DURATION = 20;

  const createSession = async (data, duration) => {
    if (duration && duration <= HEARTBEAT_DURATION) {
      active_session.create({
        startTime: moment().subtract(duration, "m").toDate(),
        endTime: new Date(),
        device: data.device,
        userUuid: data.userUuid,
        userType: data.userType ? data.userType : "Health Worker",
        duration,
      });
    }
  };

  this._createUpdateStatus = async (data) => {
    try {
      const { userUuid = "", device = "", forceUpdate = false } = data;
      let status = await user_status.findOne({
        where: {
          userUuid,
        },
        order: [["updatedAt", "ASC"]],
        raw: true,
      });

      const updatedAt = (status && status.updatedAt) || new Date();
      const duration = Math.abs(moment().diff(moment(updatedAt), "m"));

      data.lastSyncTimestamp = new Date();
      if (status) {
        if (duration > 0 && duration <= HEARTBEAT_DURATION) {
          if (!status.totalTime) status.totalTime = "0h 0m";
          const totalTime = moment(status.totalTime, this.TIME_FORMAT);
          const total = moment
            .duration({
              minutes: totalTime.get("minutes"),
              hours: totalTime.get("hours"),
            })
            .add(duration, "minutes");
          data.totalTime = this.getHourMins(total.asMinutes());
        }
        await createSession(data, duration);
        return await user_status.update(data, { where: { id: status.id } });
      } else if (!forceUpdate) {
        await createSession(data, duration);
        return await user_status.create(data);
      }
    } catch (error) {
      throw error;
    }
  };

  this._getStatuses = async (userUuid, query = {}) => {
    try {
      let where = {};
      if (userUuid) {
        where = {
          userUuid,
        };
      }
      return await user_status.findAll({
        where,
        // offset: query.start ? parseInt(query.start) : 0,
        // limit: query.limit ? parseInt(query.limit) : 10,
        raw: true,
      });
    } catch (error) {
      throw error;
    }
  };

  this.getHWVisitsInfo = async (userUuid, visits = []) => {
    const total = [];
    const completed = [];
    const inProgress = [];
    visits.forEach((i) => {
      try {
        const { encounters = [] } = i;
        const vitals = encounters.find((e) => e.display.includes("Vitals"));
        const adlIntl = encounters.find((e) =>
          e.display.includes("ADULTINITIAL")
        );
        const progress = encounters.find((e) =>
          e.display.includes("Visit Note")
        );
        const complete = encounters.find((e) =>
          e.display.includes("Visit Complete")
        );
        if (vitals || adlIntl) {
          const visit = adlIntl || vitals;
          if (visit.encounterProviders[0].provider.uuid === userUuid) {
            if (complete) {
              completed.push(i);
            } else if (progress) {
              inProgress.push(i);
            }
            total.push(i);
          }
        }
      } catch (error) {}
    });
    return {
      total,
      completed,
      inProgress,
    };
  };

  const getVisits = async () => {
    try {
      const visitApiUrl =
        "/openmrs/ws/rest/v1/visit?includeInactive=false&v=custom:(uuid,patient:(uuid,identifiers:(identifier),person:(display,gender,age,birthdate)),location:(display),encounters:(display,obs:(display,uuid,value),encounterDatetime,voided,encounterType:(display),encounterProviders),attributes)";
      const res = await axiosInstance.get(visitApiUrl);
      return res.data.results;
    } catch (error) {
      log("error:getVisits ", error);
    }
  };

  const getVisitsInfo = async (userUuid, type) => {
    const visits = await getVisits();
    switch (type) {
      case "dr":
        return {
          total: [],
          completed: [],
          inProgress: [],
        };
      default:
        return await getHWVisitsInfo(userUuid, visits);
    }
  };

  this._profile = async (userUuid, query) => {
    const url = `/openmrs/ws/rest/v1/provider?user=${userUuid}&v=custom:(uuid,person:(uuid,display,gender),attributes)`;
    const { data } = await axiosInstance.get(url);

    if (data.results.length) {
      const [user] = data.results;
      const Gender = user.person.gender || "";
      let attributes = {};
      user.attributes.forEach((attr) => {
        attributes[attr.attributeType.display] = attr.value || "";
      });
      const { total, inProgress, completed } = await getVisitsInfo(
        user.uuid,
        query.type
      );

      profieData = {
        userName: user.person.display,
        Designation: attributes.qualification || "",
        AboutMe: attributes.aboutMe || "",
        patientRegistered: total.length,
        visitInProgress: inProgress.length,
        CompletedConsultation: completed.length,
        personalInformation: {
          Gender,
          State: attributes.visitState || "",
          Mobile: attributes.phoneNumber || "",
          WhatsApp: attributes.whatsapp || "",
          Email: attributes.emailId || "",
        },
      };
      return profieData;
    } else {
      throw new Error("Data not found!");
    }
  };
  const getUserProviders = async (userUuid) => {
    const url = `/openmrs/ws/rest/v1/provider?user=${userUuid}&v=custom:(uuid,person:(uuid,display,gender),attributes:(uuid,value,attributeType:(display,uuid)))`;
    const { data } = await axiosInstance.get(url);
    return data;
  };

  this._updateProfile = async (userUuid, dataToUpdate) => {
    const data = await getUserProviders(userUuid);
    if (data.results.length) {
      const [user] = data.results;
      const {
        data: { results: attrTypes },
      } = await axiosInstance.get(
        `/openmrs/ws/rest/v1//providerattributetype?v=custom:(uuid,name)`
      );
      for (const key in dataToUpdate) {
        if (Object.hasOwnProperty.call(dataToUpdate, key)) {
          const value = dataToUpdate[key];
          const attr = attrTypes.find((a) => a.name === key);
          if (key === "gender") {
            const url = `/openmrs/ws/rest/v1/person/${user.person.uuid}`;
            await axiosInstance.post(url, { gender: value }).catch((err) => {});
          }
          if (attr) {
            const usrAttr = user.attributes.find(
              (ua) => ua.attributeType.display === key
            );
            if (usrAttr) {
              //update
              const payload = {
                attributeType: usrAttr.attributeType.uuid,
                value,
              };
              const url = `/openmrs/ws/rest/v1/provider/${user.uuid}/attribute/${usrAttr.uuid}`;
              await axiosInstance.post(url, payload).catch((err) => {});
            } else {
              //create if already exists
              const payload = {
                attributeType: attr.uuid,
                value,
              };
              const url = `/openmrs/ws/rest/v1/provider/${user.uuid}/attribute`;
              await axiosInstance.post(url, payload).catch((err) => {});
            }
          }
        }
      }
      let attributes = {};
      let [userData] = (await getUserProviders(userUuid)).results;
      userData.attributes.forEach((attr) => {
        attributes[attr.attributeType.display] = attr.value || "";
      });
      userData.attributes = attributes;
      return userData;
    } else {
      throw new Error("Data not found!");
    }
  };

  this.getHourMins = (val = 0) => {
    let hr = Math.abs(Math.floor(val / 60));
    let min = Math.abs(val % 60);
    hr = !isNaN(hr) ? hr : 0;
    min = !isNaN(min) ? min : 0;
    return `${hr}h ${min}m`;
  };
  return this;
})();
