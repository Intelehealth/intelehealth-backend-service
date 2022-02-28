const { user_status } = require("../models");
const { axiosInstance } = require("../handlers/helper");

module.exports = (function () {
  this._createUpdateStatus = async (data) => {
    try {
      const { userUuid = "", device = "", forceUpdate = false } = data;
      const status = await user_status.findOne({
        where: {
          userUuid,
          device,
        },
      });
      if (status) {
        return await user_status.update(data, { where: { id: status.id } });
      } else if (!forceUpdate) {
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
        offset: query.start ? parseInt(query.start) : 0,
        limit: query.limit ? parseInt(query.limit) : 10,
        raw: true,
      });
    } catch (error) {
      throw error;
    }
  };

  this.getHWVisitsInfo = async (userUuid, visits = []) => {
    console.log(visits);
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
      console.log("error:getVisits ", error);
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
      const Gender = user.person.gender || "NA";
      let attributes = {};
      user.attributes.forEach((attr) => {
        attributes[attr.attributeType.display] = attr.value || "NA";
      });
      const { total, inProgress, completed } = await getVisitsInfo(
        user.uuid,
        query.type
      );

      profieData = {
        userName: user.person.display,
        Designation: attributes.qualification || "NA",
        AboutMe: attributes.aboutMe || "NA",
        patientRegistered: total.length,
        visitInProgress: inProgress.length,
        CompletedConsultation: completed.length,
        personalInformation: {
          Gender,
          State: attributes.visitState || "NA",
          Mobile: attributes.phoneNumber || "NA",
          WhatsApp: attributes.whatsapp || "NA",
          Email: attributes.emailId || "NA",
        },
      };
      return profieData;
    } else {
      throw new Error("Data not found!");
    }
  };
  return this;
})();
