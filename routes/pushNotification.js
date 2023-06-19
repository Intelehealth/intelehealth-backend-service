const express = require("express");
const router = express.Router();
const webpush = require("web-push");
const mysql = require("../public/javascripts/mysql/mysql");
// console.log(webpush.generateVAPIDKeys(),"---------------");
const days = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

router.post("/subscribe", async (req, res) => {
  let speciality = req.body.speciality;
  let notification_object = JSON.stringify(req.body.sub);
  let details = {
    notification_object,
    speciality,
    doctor_name: req.body.providerName,
    date_created: new Date(),
    user_uuid: req.body.user_uuid,
    finger_print: req.body.finger_print,
  };
  const pushnotification = await new Promise((res, rej) => {
    mysql.query(
      `Select * from pushnotification where user_uuid='${details.user_uuid}' AND finger_print='${details.finger_print}'`,
      (err, results) => {
        if (!err) res(results);
        else rej(err);
      }
    );
  });

  // Delete pushNotification records for another user with the same M/C logged in
  const deletePushNotificationObject = await new Promise((res, rej) => {
    mysql.query(
      `DELETE FROM pushnotification WHERE user_uuid !='${details.user_uuid}' AND finger_print='${details.finger_print}'`,
      (err, results) => {
        if (!err) res(results);
        else rej(err);
      }
    );
  });

  if (pushnotification && pushnotification.length) {
    mysql.query(
      `UPDATE pushnotification SET notification_object='${details.notification_object}'
       WHERE user_uuid='${details.user_uuid}' and finger_print='${details.finger_print}'`,
      (err, results, fields) => {
        if (err) res.status(400).json({ message: err.message });
        else
          res
            .status(200)
            .json({ results, fields, message: "Updated Successfully" });
      }
    );
  } else {
    mysql.query(
      "Insert into pushnotification SET ?",
      details,
      (err, results, fields) => {
        if (!err) res.status(200).json({ message: "Subscribed Successfully" });
        else res.status(400).json({ message: "Not Subscribed" });
      }
    );
  }
});

//for ezazi server
const vapidKeys = {
  publicKey:
  "BM4tUVW1UwkMpfAWh2mwhA-wwdIC2rCF1MFypbFpjn23qYMQXaeAaYi6ydGslRb_Vdr2Ws0MW5RSUH9InEbYNhA",
  privateKey: "2x0DTVhRpzAaBfbcdWJNrBk7yTTE2gJivTavfLjQXhY",
  mailTo: "mailto:support@intelehealth.org",
};

router.post("/push", (req, res) => {
  try {
    mysql.query(
      `Select notification_object, doctor_name, user_uuid from pushnotification where speciality='${req.body.speciality}'`,
      async (err, results) => {
        if (results.length) {
          res.set("Content-Type", "application/json");
          webpush.setVapidDetails(
            vapidKeys.mailTo,
            vapidKeys.publicKey,
            vapidKeys.privateKey
          );

          let patient = req.body.patient;
          let title = `Patient ${patient.name} seen by doctor`;
          let body = `${patient.provider}`;

          if (
            req.body.patient &&
            req.body.speciality &&
            req.body.skipFlag == false
          ) {
            title = `New Patient ${patient.name} is been uploaded`;
            body = "Please start giving consultation";
          }

          let payload = JSON.stringify({
            notification: { title, body, vibrate: [100, 50, 100] },
          });

          const userUUID = results.map((sub) => sub.user_uuid).join(`','`);

          var user_settingData = await new Promise((res, rej) => {
            mysql.query(
              `SELECT * FROM user_settings WHERE user_uuid IN ('${userUUID}')`,
              (err, results) => {
                console.log("results: ", results);
                if (err) rej(err);
                res(results);
              }
            );
          });
          let snoozed = [];
          const currTime = Date.now();
          const getSnoozeTill = (snooze_till) => {
            try {
              return JSON.parse(snooze_till);
            } catch (error) {
              return snooze_till;
            }
          };

          user_settingData.forEach((element) => {
            const snooze_till = getSnoozeTill(element.snooze_till);
            if (typeof snooze_till === "object") {
              const day = days[new Date().getDay()];
              const schedule = snooze_till.find((d) => d.day === day);
              if (schedule && schedule.startTime && schedule.endTime) {
                const start = schedule.startTime + ":00",
                  end = schedule.endTime + ":00";
                let now = new Date()
                  .toLocaleTimeString("hi-IN", { hour12: false })
                  .replace(" PM", "")
                  .replace(" AM", "");
                if (now.length === 7) {
                  now = "0" + now;
                }
                if (end >= now && now > start) {
                  snoozed.push(element);
                }
              }
            } else if (currTime <= Number(snooze_till)) {
              snoozed.push(element);
            }
          });
          snoozed.forEach((element) => {
            results.pop(element);
          });
          const allNotifications = results.map((sub) => {
            if (!patient.provider.match(sub.doctor_name)) {
              webpush
                .sendNotification(JSON.parse(sub.notification_object), payload)
                .catch((error) => {
                  console.log("error:skipFlag:second notification ", error);
                });
            }
          });

          Promise.all(allNotifications).then((response) => {
            res.status(200).json({ message: "Notification sent" });
          });
        } else
          res
            .status(200)
            .json({ message: "No doctor with same specialization found" });
      }
    );
  } catch (error) {
    res.status(400).json({ message: "Error", error });
  }
});

// router.get("/getSnoozeTime", (req, res) =>{
//         mysql.query(`Select * from user_settings`, (err, snoozeTimeData, fields) => {
//             let Data = snoozeTimeData[0].snooze_till;
//             let Data1 = Data ? Data : null
//             if(err) res.status(400).json({message: err.message});
//             else res.status(200).json({Data1, message: "Snoozed data!"})
//         })
// })

router.post(
  "/unsubscribe",
  async ({ body: { user_uuid, finger_print } }, res) => {
    mysql.query(
      `DELETE from pushnotification where user_uuid='${user_uuid}' AND finger_print='${finger_print}'`,
      (err, results) => {
        if (err) res.status(400).json({ message: err.message });
        else res.status(200).json({ results, message: "Unsubscribed!" });
      }
    );
  }
);

module.exports = router;
