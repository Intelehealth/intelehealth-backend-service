const cron = require("node-cron");
const moment = require("moment");
const mysql = require("./public/javascripts/mysql/mysql");
const webpush = require("web-push");

const cronString = "*/1 * * * *";
const SQL_DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";
const vapidKeys = {
  publicKey:
    "BCGfng5flfhjlqR_imzFXwHGeEMBA6AzFVAex7sPLDbsMCn_IMKtQmI9TDnmP6raxmPcBcnoKO_AHKaLtctsIjg",
  privateKey: "85omZfgs39Tt2R5JwB3sCkgYlSQd5mV-iAsTEz8lEoQ",
  mailTo: "mailto:support@intelehealth.org",
};
webpush.setVapidDetails(
  vapidKeys.mailTo,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const isValid = cron.validate(cronString);
console.log("cronString: isValid: ", isValid);

const sendAppointmentNotification = async () => {
  console.log("sendAppointmentNotification : cron running");
  const startDate = moment().format(SQL_DATE_FORMAT);
  const endDate = moment().subtract(1, "minutes").format(SQL_DATE_FORMAT);
  const query = `SELECT
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
      LEFT JOIN pushnotification s ON a.userUuid = s.user_uuid
  WHERE
  a.slotJsDate BETWEEN '${startDate}'
  AND '${endDate}'
  AND a.status = 'booked';`;

  const data = await new Promise((resolve, reject) => {
    mysql.query(query, (err, results) => {
      if (err) {
        console.log("err: ", err);
        reject(err.message);
      }
      resolve(results);
    });
  });
  for (let i = 0; i < data.length; i++) {
    const schedule = data[i];
    if (schedule.webpush_obj) {
      const title = `Appointment Reminder(${schedule.slotTime}): ${schedule.patientName}`;
      console.log("title: ", title);
      webpush
        .sendNotification(
          JSON.parse(schedule.webpush_obj),
          JSON.stringify({
            notification: {
              title,
              body: schedule.openMrsId,
              vibrate: [100, 50, 100],
            },
          })
        )
        .catch((error) => {
          console.log("appointment notification ", error);
        });
    }
  }
};

cron.schedule(cronString, sendAppointmentNotification, {
  scheduled: true,
});

process.on("uncaughtException", function (err) {
  console.log("Cron Server : uncaughtException->>" + err);
  throw err;
});
