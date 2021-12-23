const cron = require("node-cron");
const moment = require("moment");
const mysql = require("./public/javascripts/mysql/mysql");
const { sendWebPushNotificaion } = require("./handlers/helper");

const cronString = "*/1 * * * *";
const SQL_DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";

const isValid = cron.validate(cronString);
console.log("cronString: isValid: ", isValid);

const getQuery = (startDate, endDate) => {
  console.log("startDate, endDate: ", startDate, endDate);
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
  s.notification_object as webpush_obj
  FROM
  appointments a
  INNER JOIN pushnotification s ON a.userUuid = s.user_uuid
  WHERE
  a.slotJsDate BETWEEN '${startDate}'
  AND '${endDate}'
  AND a.status = 'booked';`;
};

const queryAndSendNotification = async (query) => {
  console.log("query: ", query);

  new Promise((resolve, reject) => {
    mysql.query(query, (err, results) => {
      if (err) {
        console.log("err: ", err);
        reject(err.message);
      }
      resolve(results);
    });
  }).then((data) => {
    console.log("data: ", data);
    for (let i = 0; i < data.length; i++) {
      const schedule = data[i];
      if (schedule.webpush_obj) {
        const title = `Appointment Reminder(${schedule.slotTime}): ${schedule.patientName}`;
        console.log("title: ", title);
        sendWebPushNotificaion({
          webpush_obj: schedule.webpush_obj,
          title,
          body: schedule.openMrsId,
        });
      }
    }
  });
};

const sendAppointmentNotification = async () => {
  console.log("sendAppointmentNotification : cron running");
  // trigger 15 mins before
  const earlyNotificationQuery = getQuery(
    moment
      .utc()
      .subtract(15, "minutes")
      .add(1, "second")
      .format(SQL_DATE_FORMAT),
    moment.utc().subtract(14, "minutes").format(SQL_DATE_FORMAT)
  );
  queryAndSendNotification(earlyNotificationQuery);

  // trigger 1 mins before
  const query = getQuery(
    moment
      .utc()
      .subtract(1, "minutes")
      .add(1, "second")
      .format(SQL_DATE_FORMAT),
    moment.utc().format(SQL_DATE_FORMAT)
  );

  queryAndSendNotification(query);
};

cron.schedule(cronString, sendAppointmentNotification, {
  scheduled: true,
});

process.on("uncaughtException", function (err) {
  console.log("Cron Server : uncaughtException->>" + err);
  throw err;
});
