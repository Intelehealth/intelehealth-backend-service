const CronJob = require("cron").CronJob;
const {
  getDataFromQuery,
  sendWebPushNotificaion,
  axiosInstance,
} = require("./handlers/helper");

const visitApiUrl =
  "/openmrs/ws/rest/v1/visit?includeInactive=false&v=custom:(uuid,patient:(uuid,identifiers:(identifier),person:(display,gender,age,birthdate)),location:(display),encounters:(display,obs:(display,uuid,value),encounterDatetime,voided,encounterType:(display),encounterProviders),attributes)";
const specialityQuery = (spec) =>
  `Select notification_object,location,speciality, doctor_name, user_uuid from pushnotification where speciality='${spec}'`;

const getVisits = async () => {
  try {
    const res = await axiosInstance.get(visitApiUrl);
    return res.data.results;
  } catch (error) {
    console.log("error:getVisits ", error);
  }
};

const checkVisit = (encounters, visitType) => {
  return encounters.find(({ display = "" }) => display.includes(visitType));
};

const getAwaitingAndPriorityVisits = async (
  visits,
  speciality = "General Physician",
  location = "Jharkhand"
) => {
  try {
    const stateVisits = visits.filter((v) => {
      let flag = false;
      const loc = v.attributes.find(
        (a) => a.attributeType.uuid === "0e798578-96c1-450b-9927-52e45485b151"
      );
      if (loc && (loc.value === location || location === "All")) flag = true;
      return flag;
    });
    const visitNoEnc = stateVisits.filter((v) => v.encounters.length > 0);
    let filteredVisits = visitNoEnc;
    if (speciality !== "General Physician")
      filteredVisits = stateVisits.filter((v) => v.attributes.length > 0);
    const specialityVisits = filteredVisits.filter((v) => {
      let flag = false;
      const spec = v.attributes.find(
        (a) => a.attributeType.uuid === "3f296939-c6d3-4d2e-b8ca-d7f4bfd42c2d"
      );
      if (spec && spec.value === speciality) flag = true;
      return flag;
    });
    const awaiting = [];
    const priority = [];
    specialityVisits.forEach((visit) => {
      let cachedVisit;
      if (checkVisit(visit.encounters, "Visit Complete")) {
      } else if (checkVisit(visit.encounters, "Visit Note")) {
      } else if ((cachedVisit = checkVisit(visit.encounters, "Flagged"))) {
        if (!cachedVisit.voided) priority.push(visit);
      } else if (
        checkVisit(visit.encounters, "ADULTINITIAL") ||
        checkVisit(visit.encounters, "Vitals")
      ) {
        awaiting.push(visit);
      }
    });

    return [awaiting.length, priority.length];
  } catch (error) {
    console.log("error:getAwaitingAndPriorityVisits: ", error);
    return [0, 0];
  }
};

const sendNotification = async () => {
  const visits = await getVisits();
  try {
    console.log("Cron function running......");
    const data = await getDataFromQuery(
      "SELECT distinct speciality from pushnotification;"
    );
    await asyncForEach(data, async (d) => {
      const data = await getDataFromQuery(specialityQuery(d.speciality));
      await asyncForEach(data, async (obj) => {
        const speciality = obj.speciality;
        const location = obj.location;
        const [awaiting, priority] = await getAwaitingAndPriorityVisits(
          visits,
          speciality,
          location
        );
        console.log("awaiting: ", awaiting);
        console.log("priority: ", priority);
        if (awaiting > 0 || priority > 0) {
          await sendWebPushNotificaion({
            webpush_obj: obj.notification_object,
            title: "New Patient has been uploaded",
            body: "Please start giving consultation",
            options: {
              TTL: 2 * 60 * 60, //It's in seconds, so this will be 2 hr
            },
          });
        }
      });
    });
    console.log("Cron completed--------------------------------------------");
  } catch (error) {
    console.error(error);
  }
};

const cronString = `*/15 * * * *`;
new CronJob(cronString, sendNotification, null, true, "Asia/Kolkata");
console.log("Cron started......");
