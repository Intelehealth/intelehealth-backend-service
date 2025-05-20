const express = require("express");
const router = express.Router();
const webpush = require("web-push");
const mysql = require("../handlers/mysql/mysql");
const days = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO } = process.env;

router.post("/subscribe", async (req, res) => {
  try{
    const speciality = req.body.speciality;
    const notification_object = JSON.stringify(req.body.sub);
    const finger_print = req.body.finger_print ? req.body.finger_print : "";
    const details = {
      notification_object,
      speciality,
      doctor_name: req.body.providerName,
      user_uuid: req.body.user_uuid,
      locale: req.body.locale ? req.body.locale : "en",
      finger_print
    };
    const pushnotification = await new Promise((res, rej) => {
      mysql.query(
        `Select * from pushnotification where user_uuid='${details.user_uuid}'`,
        (err, results) => {
          if (!err) res(results);
          else rej(err);
        }
      );
    });

    // Delete pushNotification records for another user with the same M/C logged in
    await new Promise((res, rej) => {
      mysql.query(
        `DELETE FROM pushnotification WHERE user_uuid !='${details.user_uuid}' and finger_print = '${details.finger_print}'`,
        (err, results) => {
          if (!err) res(results);
          else rej(err);
        }
      );
    });

    if (pushnotification && pushnotification.length) {
      mysql.query(
        `UPDATE pushnotification SET notification_object='${details.notification_object}',locale='${details.locale}', finger_print = '${details.finger_print}'
        WHERE user_uuid='${details.user_uuid}'`,
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
        `INSERT INTO mindmap_server.pushnotification
        (notification_object,
        speciality,
        doctor_name,
        date_created,
        user_uuid,
        finger_print,
        locale)VALUES
        ('${details.notification_object}',
        '${details.speciality}',
        '${details.doctor_name}',
        CURRENT_TIMESTAMP,
        '${details.user_uuid}',
        '${details.finger_print}',
        '${details.locale}')`,
        (err, results, fields) => {
          if (!err) res.status(200).json({ message: "Subscribed Successfully" });
          else res.status(400).json({ message: "Not Subscribed" });
        }
      );
    }
  } catch(e){
    res.status(400).json({ message: "Error", error });
  }
});

router.post("/push", (req, res) => {
  try {
    mysql.query(
      `Select notification_object, doctor_name, user_uuid from pushnotification where speciality='${req.body.speciality}'`,
      async (err, results) => {
        if (results.length) {
          res.set("Content-Type", "application/json");
          webpush.setVapidDetails(
            VAPID_MAILTO,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
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

router.post(
  "/unsubscribe",
  async ({ body: { user_uuid } }, res) => {
    mysql.query(
      `DELETE from pushnotification where user_uuid='${user_uuid}'`,
      (err, results) => {
        if (err) res.status(400).json({ message: err.message });
        else res.status(200).json({ results, message: "Unsubscribed!" });
      }
    );
  }
);

module.exports = router;
