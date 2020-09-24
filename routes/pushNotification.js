const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const mysql = require('../public/javascripts/mysql/mysql');


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
        if (!err) res.status(200).json({message: 'Subscribed Successfully'})
        else req.status(400).json({message: 'Not Subscribed'})
    })
})

router.post('/push', (req, res) => {
    if (req.body.patient && req.body.speciality) {
        mysql.query(`Select notification_object, doctor_name from pushnotification where speciality='${req.body.speciality}'`, (err, results) => {
            if (results.length) {
                res.set('Content-Type', 'application/json');
                webpush.setVapidDetails(
                    'mailto:support@intelehealth.org',
                    'BFwuhYcJpWKFnTewNm9XtBTycAV_qvBqvIfbALC02CtOaMeXwrO6Zhm7MI_NIjDV9_TCbrr0FMmaDnZ7jllV6Xg',
                    'HtukOxUF1y0eV_fgLxO192-r3VUtvMXqoiDlrBQmntI'
                );
                let patient = req.body.patient;
                let payload = JSON.stringify({
                    notification : {
                        title: `Patient ${patient.name} seen by doctor`,
                        body: `${patient.provider}`,
                        vibrate: [100, 50, 100],
                    }
                })
                
                Promise.all(results.map(sub => {
                    if (!patient.provider.match(sub.doctor_name)) {
                        webpush.sendNotification(JSON.parse(sub.notification_object), payload)
                    }}))
                    .then(() => res.status(200).json({message: 'Notification sent'}))
            } else res.status(200).json({message: 'No doctor with same specialization found'})
        })
    } else res.status(400).json({message: 'Error'})
})

module.exports = router;