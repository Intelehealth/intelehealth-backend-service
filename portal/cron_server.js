const cron = require("node-cron");
const moment = require("moment");
const mysql = require("./handlers/mysql/mysql");
const { sendWebPushNotification } = require("./handlers/helper");

const cronString = "*/1 * * * *";
const SQL_DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";

const isValid = cron.validate(cronString);

const getQuery = (startDate, endDate) => {
  return `SELECT
  a.slotDate,
  a.slotJsDate,
  a.slotDuration,
  a.slotDurationUnit,
  a.slotTime,
  a.speciality,
  a.userUuid,
  a.drName,
  a.visitUuid,
  a.patientId,
  a.patientName,
  a.openMrsId,
  a.status,
  s.notification_object as webpush_obj,
  s.locale as locale 
  FROM
  appointments a
  INNER JOIN pushnotification s ON a.userUuid = s.user_uuid
  WHERE
  a.slotJsDate BETWEEN '${startDate}'
  AND '${endDate}'
  AND a.status = 'booked';`;
};

const queryAndSendNotification = async (query) => {
  new Promise((resolve, reject) => {
    mysql.query(query, (err, results) => {
      if (err) {
        reject(err.message);
      }
      resolve(results);
    });
  }).then((data) => {
    for (let i = 0; i < data.length; i++) {
      const schedule = data[i];
      if (schedule.webpush_obj) {
        const engTitle = `Appointment Reminder(${schedule.slotTime}): ${schedule.patientName}`;
        const ruTitle = `Напоминание о встрече(${schedule.slotTime}): ${schedule.patientName}`;
        const title = schedule.locale === "ru" ? ruTitle : engTitle;
        sendWebPushNotification({
          webpush_obj: schedule.webpush_obj,
          title,
          body: schedule.openMrsId,
        });
      }
    }
  });
};

const sendAppointmentNotification1min = async () => {
  // trigger 1 mins before
  const query = getQuery(
    moment.utc().add(1, "second").format(SQL_DATE_FORMAT),
    moment.utc().add(1, "minute").format(SQL_DATE_FORMAT)
  );

  queryAndSendNotification(query);
};

const sendAppointmentNotification15min = async () => {
  // trigger 15 mins before
  const earlyNotificationQuery = getQuery(
    moment.utc().add(14, "minutes").add(1, "second").format(SQL_DATE_FORMAT),
    moment.utc().add(15, "minutes").format(SQL_DATE_FORMAT)
  );
  queryAndSendNotification(earlyNotificationQuery);
};

cron.schedule(cronString, sendAppointmentNotification1min, {
  scheduled: true,
});
cron.schedule(cronString, sendAppointmentNotification15min, {
  scheduled: true,
});

process.on("uncaughtException", function (err) {
  throw err;
});
