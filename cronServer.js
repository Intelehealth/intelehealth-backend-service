const CronJob = require("cron").CronJob;
const axios = require("axios");
const moment = require("moment");
const querystring = require("querystring");
const {
  getVisitCountQueryForGp,
  getVisitCountQuery,
} = require("./controllers/queries");
// const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const openMrsDB = require("./public/javascripts/mysql/mysqlOpenMrs");

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

const axiosKaleyra = axios.create({
  baseURL: "https://api.in.kaleyra.io",
  timeout: 50000,
  headers: { "content-type": "application/x-www-form-urlencoded" },
});

const checkVisit = (encounters, visitType) => {
  return encounters.find(({ display = "" }) => display.includes(visitType));
};

const getVisitCounts = async (speciality = "General Physician") => {
  const query =
    speciality === "General Physician"
      ? getVisitCountQueryForGp()
      : getVisitCountQuery({ speciality });

  try {
    return await new Promise((resolve, reject) => {
      openMrsDB.query(query, (err, results, fields) => {
        if (err) reject(err);
        resolve(results);
      });
    }).catch((err) => {
      throw err;
    });
  } catch (error) {
    console.log("error: ", error);

    return [
      {
        Total: 0,
        Status: "Awaiting Consult",
      },
      {
        Total: 0,
        Status: "Completed Visit",
      },
      {
        Total: 0,
        Status: "Priority",
      },
      {
        Total: 0,
        Status: "Visit In Progress",
      },
    ];
  }
};

const getPriorityAwaitingVisitCount = async () => {
  try {
    const data = await getVisitCounts();
    if (Array.isArray(data)) {
      const awaiting = data.find((d) => d.Status === "Awaiting Consult").Total;
      const priority = data.find((d) => d.Status === "Priority").Total;
      return awaiting + priority;
    } else {
      console.log("getVisitCounts - data: ", data);
    }
  } catch (error) {
    console.log("error: ", error);
  }
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

const sendSMS = async (docArray = []) => {
  // const visits = await getVisits();
  try {
    console.log("Cron hour sms function running......");

    const priorityAwaitingCount = await getPriorityAwaitingVisitCount();
    console.log("priorityAwaitingCount: ", priorityAwaitingCount);

    if (priorityAwaitingCount > 0) {
      const sendMessage = getTemplateOne(priorityAwaitingCount, 1);

      for (let idx = 0; idx < docArray.length; idx++) {
        const doc = docArray[idx];
        await postSMSToMobileNumber(doc.mobNo, sendMessage);
      }
    }

    console.log(
      "Cron hour sms completed--------------------------------------------"
    );
  } catch (error) {
    console.error(error);
  }
};

const sendSMSToDoctorEveryHour = async () => {
  const now = moment();
  const format = "hh:mm:ss";
  const startTime = moment("07:00:00", format); /** 7 am */
  const endTime = moment("20:00:00", format); /** 8 pm */
  const result = now.isBetween(startTime, endTime); // returns true
  if (result) {
    const docArray = [
      { name: "Dr. Manish ", mobNo: "919113320079" },
      { name: "Dr. Akash ", mobNo: "919422109789" },
    ];
    sendSMS(docArray);
  }
};

const sendSMSToDoctorTwiceADay = async () => {
  const now = moment();
  const format = "HH:mm:ss";
  const startTime = moment("07:00:00", format); /** 7 am */
  const endTime = moment("20:00:00", format); /** 8 pm */
  const result = now.isBetween(startTime, endTime); // returns true
  if (result) {
    const docArray = [
      { name: "Dr. Mukul Bhatia", mobNo: "919608159914" },
      { name: "Dr. RN Mehta", mobNo: "919426365188" },
    ];
    sendSMS(docArray);
  }
};

const getTemplateOne = (numOfPatients, sinceHours) => {
  return `Dear Doctor,Namaskar.${numOfPatients} Patients are eagerly waiting your Expert Consultation (For ${sinceHours} hour/hours).Please attend. Thanks- Ekal Arogya Foundation of India`;
};

const postSMSToMobileNumber = async (mobNo, message) => {
  try {
    const axiosOptions = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "api-key": "A7b6e3f43afd56b241d4aaf9fcb73d742",
      },
    };

    const payload = querystring.stringify({
      to: mobNo,
      sender: "AFIEAP",
      type: "TXN",
      source: "API",
      template_id: "1107165751297923593",
      body: message,
    });

    await axiosKaleyra
      .post("/v1/HXIN1739030324IN/messages", payload, axiosOptions)
      .catch(function (error) {
        console.log(error);
      });
  } catch (error) {}
};

const cronString = `*/15 * * * *`;
new CronJob(cronString, sendNotification, null, true, "Asia/Kolkata");

new CronJob(
  "2 */1 * * *",
  sendSMSToDoctorEveryHour,
  null,
  true,
  "Asia/Kolkata"
);

new CronJob(
  "0 10 */1 * *",
  sendSMSToDoctorTwiceADay,
  null,
  true,
  "Asia/Kolkata"
); /** everyday at 10 am */
new CronJob(
  "0 14 */1 * *",
  sendSMSToDoctorTwiceADay,
  null,
  true,
  "Asia/Kolkata"
); /** everyday at 2 pm */

console.log("Cron started......");
