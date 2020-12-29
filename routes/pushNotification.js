const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const mysql = require('../public/javascripts/mysql/mysql');
// console.log(webpush.generateVAPIDKeys(),"---------------");

router.post('/subscribe', (req, res) => {
    let speciality = req.body.speciality;
    let notification_object = JSON.stringify(req.body.sub);
    let details = {
        notification_object,
        speciality,
        doctor_name: req.body.providerName,
        date_created: new Date()
    }
    mysql.query('Insert into pushnotification SET ?', details, (err, results, fields) => {
        if (!err) res.status(200).json({ message: 'Subscribed Successfully' })
        else res.status(400).json({ message: 'Not Subscribed' })
    })
})

router.post('/push', (req, res) => {
    try {
        if (req.body.patient && req.body.speciality && req.body.skipFlag) {

            mysql.query(`Select notification_object, doctor_name from pushnotification where speciality='${req.body.speciality}'`, (err, results) => {
                if (results.length) {
                    res.set('Content-Type', 'application/json');
                    webpush.setVapidDetails(
                        'mailto:support@intelehealth.org',
                        'BGg2p-PUsSzVF-_DgnNfTPTtnel4-oX7Z6lHT7BnDv88D-SffP_dj1XFVV_r0CsUKz59HmaJp8JadZuHNzzWyzs',
                        'W-9bITwllMhYDNx8jmtC1Mt1m4co2RCYRdcGAxJEpng'
                    );

                    // BDGWYaKQhSDtC8VtcPekovFWM4M7mhs3NHe-X1HA7HH-t7nkiexSyYxUxQkwl2H44BiojKJjOdXi367XgxXxvpw
                    // vIrlMoYDp0cmfsKDfwdfv0GTqxU72CQabHgmtjPj4WY
                    
                    let patient = req.body.patient;
                    let payload = JSON.stringify({
                        notification: {
                            title: `Patient ${patient.name} seen by doctor`,
                            body: `${patient.provider}`,
                            vibrate: [100, 50, 100],
                        }
                    })
                    Promise.all(results.map(sub => {
                        if (!patient.provider.match(sub.doctor_name)) {
                            webpush.sendNotification(JSON.parse(sub.notification_object), payload)
                        }
                    })).then(() => res.status(200).json({ message: 'Notification sent' }))
                } else res.status(200).json({ message: 'No doctor with same specialization found' })
            })
        } else if (req.body.skipFlag == false) {
            mysql.query(`Select notification_object, doctor_name from pushnotification where speciality='${req.body.speciality}'`, (err, results) => {
                if (results.length) {
                    console.log('results.length: ', results.length);
                    res.set('Content-Type', 'application/json');
                    webpush.setVapidDetails(
                        'mailto:support@intelehealth.org',
                        'BGg2p-PUsSzVF-_DgnNfTPTtnel4-oX7Z6lHT7BnDv88D-SffP_dj1XFVV_r0CsUKz59HmaJp8JadZuHNzzWyzs',
                        'W-9bITwllMhYDNx8jmtC1Mt1m4co2RCYRdcGAxJEpng'
                    );
                    let patient = req.body.patient;
                    console.log('patient: ', patient);
                    let payload1 = JSON.stringify({
                        notification: {
                            title: `New Patient ${patient.name} is been uploaded`,
                            body: "Please start giving consultation",
                            vibrate: [100, 50, 100]
                        }
                    })
                    console.log('payload1: ', payload1);
                    Promise.all(results.map(sub => {
                        if (!patient.provider.match(sub.doctor_name)) {
                            webpush.sendNotification(JSON.parse(sub.notification_object), payload1)
                        }
                    })).then(() => res.status(200).json({ message: 'Notification sent' }))
                } else res.status(200).json({ message: 'No doctor with same specialization found' })
            })
        }
    } catch (error) {
        res.status(400).json({ message: 'Error', error })
    }
})

module.exports = router;