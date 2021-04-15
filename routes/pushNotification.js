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
}

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



// *  For mtdserver Server
// const vapidKeys = {
//     publicKey:
//         "BOKq0TfYyhJCB49SYbdh9cOekujAcwnM1LpTcc0L8kxye5kNFImCsP-n_3ymrOBshFIJP8QocMDYyVAyM4WTGd8",
//     privateKey: "F38MFPNQFYW6uAYglSTHqhjWMMsqodBmzPF81c7hg60",
//     mailTo: "mailto:support@intelehealth.org"
//   };

// *  For Testing Server
const vapidKeys = {
    publicKey:
        "BAfolLQ7VpRSmWm6DskG-YyG3jjzq5z0rjKEl5HXLCw2W8CKS9cVmifnCAWnrlJMETgbgjuV1pWKLUf8zlbojH0",
    privateKey: "kCDISA3-UoW0pEx_gSTm4VtQASbvza-uw27Mq1x2wEc",
    mailTo: "mailto:support@intelehealth.org"
};
router.post("/push", (req, res) => {
    try {
        mysql.query(
            `Select notification_object, doctor_name, user_uuid from pushnotification where speciality='${req.body.speciality}'`,
            async (err, results) => {
                if (results.length) {
                    res.set("Content-Type", "application/json");
                    webpush.setVapidDetails(vapidKeys.mailTo, vapidKeys.publicKey, vapidKeys.privateKey);

                    let patient = req.body.patient;
                    let title = `Patient ${patient.name} seen by doctor`;
                    let body = `${patient.provider}`;

                    if (req.body.patient && req.body.speciality && req.body.skipFlag == false) {
                        title = `New Patient ${patient.name} is been uploaded`
                        body = "Please start giving consultation"
                    }

                    let payload = JSON.stringify({
                        notification: { title, body, vibrate: [100, 50, 100], },
                    });

                    const userUUID = results.map((sub) => sub.user_uuid).join(`','`);

                    var user_settingData = await new Promise((res, rej) => {
                        mysql.query(`SELECT * FROM user_settings WHERE user_uuid IN ('${userUUID}')`,
                            (err, results) => {

                                if (err) rej(err)
                                res(results)
                            })
                    })
                    let snoozed = []
                    const currTime = Date.now();
                    const getSnoozeTill = (snooze_till) => {
                        try {
                            return JSON.parse(snooze_till)
                        } catch (error) {
                            return snooze_till
                        }
                    }
                    user_settingData.forEach(element => {
                        const snooze_till = getSnoozeTill(element.snooze_till);
                        if (typeof snooze_till === 'object') {
                            const day = days[new Date().getDay()];
                            const schedule = snooze_till.find(d => d.day === day);
                            if (schedule && schedule.startTime && schedule.endTime) {
                                const start = schedule.startTime + ":00", end = schedule.endTime + ":00";
                                let now = new Date().toLocaleTimeString().replace(' PM', '').replace(' AM', '')
                                if (now.length === 7) now = "0" + now
                                if (end >= now && now > start) snoozed.push(element);
                            }
                        } else if (currTime <= Number(snooze_till)) {
                            snoozed.push(element);
                        }
                    });
                    snoozed.forEach(element => {
                        results.pop(element);
                    });
                    const allNotifications = results.map((sub) => {

                        if (!patient.provider.match(sub.doctor_name)) {

                            webpush
                                .sendNotification(
                                    JSON.parse(sub.notification_object),
                                    payload
                                )
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

router.post("/change_password", async (req, res) => {
    let userId = req.body.userId;
    console.log('user_uuid: ', userId);

    const userUUID = await new Promise((res, rej) => {
        mysql.query(
            `Select * from user_settings where user_uuid='${userId}' LIMIT 0, 1`,
            (err, results) => {
                if (!err) res(results);
                else rej(err);
            }
        );
    });
    console.log('userUUID: ', userUUID.length);

    if (userUUID && userUUID.length) {
        mysql.query(
            `UPDATE user_settings SET isPasswordChange=1 where user_uuid='${userId}'`,
            (err, results, fields) => {
                if (err) res.status(400).json({ message: err.message });
                else
                    res
                        .status(200)
                        .json({ results, fields, message: "Updated Successfully" });
            }
        );
    } else {
        const details = {
            user_uuid: userId,
            isPasswordChange: 1,
            snooze_till: null
        }
        mysql.query(
            "Insert into user_settings SET ?",
            details,
            (err, results, fields) => {
                if (!err) res.status(200).json({ message: "User added successfully!" });
                else res.status(400).json({ message: "User Not Added" });
            }
        );
    }
});

module.exports = router;
