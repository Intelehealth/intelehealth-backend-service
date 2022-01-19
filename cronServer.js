const CronJob = require("cron").CronJob;
const {
  getDataFromQuery,
  sendWebPushNotificaion,
} = require("./handlers/helper");

const specialityQuery = (spec) =>
  `Select notification_object, doctor_name, user_uuid from pushnotification where speciality='${spec}'`;

const sendNotification = async () => {
  try {
    console.log("Cron function running......");
    const data = await getDataFromQuery(
      "SELECT distinct speciality from pushnotification;"
    );
    await asyncForEach(data, async (d) => {
      const data = await getDataFromQuery(specialityQuery(d.speciality));
      await asyncForEach(data, async (obj) => {
        await sendWebPushNotificaion({
          webpush_obj: obj.notification_object,
          title: "New Patient has been uploaded",
          body: "Please start giving consultation",
        });
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
