const express = require("express");
const router = express.Router();
const webpush = require("web-push");
const mysql = require("../public/javascripts/mysql/mysql");
// console.log(webpush.generateVAPIDKeys(),"---------------");

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

  if (pushnotification && pushnotification.length) {
    mysql.query(
      `UPDATE pushnotification SET notification_object='${details.notification_object}'
       WHERE user_uuid='${details.user_uuid}' and finger_print='${details.finger_print}'`,
      (err, results) => {
        if (err) res.status(400).json({ message: err.message });
        else res.status(200).json({ results, message: "Updated Successfully" });
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

// afi
// const vapidKeys = {
//   publicKey:
//     "BAfolLQ7VpRSmWm6DskG-YyG3jjzq5z0rjKEl5HXLCw2W8CKS9cVmifnCAWnrlJMETgbgjuV1pWKLUf8zlbojH0",
//   privateKey: "kCDISA3-UoW0pEx_gSTm4VtQASbvza-uw27Mq1x2wEc",
// };

// demo;
const vapidKeys = {
  publicKey:
    "BIWPsR9rM0wmZxNDcoXzL8-yDm-iCXu6L-atyFaCiA9ekoZR8d5iE5Mqf_zZOBkoAVMWUVHOv5PDao0p2rt4McQ",
  privateKey: "hA8KGnsfjPPiYc53fQJZ7Hq6H8BnQ3fdV3o2DxxwIJs",
};

router.post("/push", (req, res) => {
  try {
    if (req.body.patient && req.body.speciality && req.body.skipFlag) {
      mysql.query(
        `Select notification_object, doctor_name from pushnotification where speciality='${req.body.speciality}'`,
        (err, results) => {
          if (results.length) {
            res.set("Content-Type", "application/json");
            webpush.setVapidDetails(
              "mailto:support@intelehealth.org",
              vapidKeys.publicKey,
              vapidKeys.privateKey
            );

            let patient = req.body.patient;
            let payload = JSON.stringify({
              notification: {
                title: `Patient ${patient.name} seen by doctor`,
                body: `${patient.provider}`,
                vibrate: [100, 50, 100],
              },
            });
            const allNotifications = results.map((sub) => {
              if (!patient.provider.match(sub.doctor_name)) {
                webpush
                  .sendNotification(
                    JSON.parse(sub.notification_object),
                    payload
                  )
                  .catch((error) => {});
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
    } else if (req.body.skipFlag == false) {
      mysql.query(
        `Select notification_object, doctor_name from pushnotification where speciality='${req.body.speciality}'`,
        (err, results) => {
          if (results.length) {
            console.log("results.length: ", results.length);
            res.set("Content-Type", "application/json");
            webpush.setVapidDetails(
              "mailto:support@intelehealth.org",
              vapidKeys.publicKey,
              vapidKeys.privateKey
            );
            // webpush.setVapidDetails(
            //   "mailto:support@intelehealth.org",
            //   "BDGWYaKQhSDtC8VtcPekovFWM4M7mhs3NHe-X1HA7HH-t7nkiexSyYxUxQkwl2H44BiojKJjOdXi367XgxXxvpw",
            //   "vIrlMoYDp0cmfsKDfwdfv0GTqxU72CQabHgmtjPj4WY"
            // );
            let patient = req.body.patient;
            let payload1 = JSON.stringify({
              notification: {
                title: `New Patient ${patient.name} is been uploaded`,
                body: "Please start giving consultation",
                vibrate: [100, 50, 100],
              },
            });
            Promise.all(
              results.map((sub) => {
                if (!patient.provider.match(sub.doctor_name)) {
                  webpush
                    .sendNotification(
                      JSON.parse(sub.notification_object),
                      payload1
                    )
                    .catch((error) => {});
                }
              })
            ).then(() =>
              res.status(200).json({ message: "Notification sent" })
            );
          } else
            res
              .status(200)
              .json({ message: "No doctor with same specialization found" });
        }
      );
    }
  } catch (error) {
    res.status(400).json({ message: "Error", error });
  }
});

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
