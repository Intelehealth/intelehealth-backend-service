const webpush = require('web-push');
const mindmapDB = require("../public/javascripts/mysql/mysql");

async function sendNotification(subscription, title, body) {
    const payload = {
        notification: {
            title,
            body,
            icon: 'assets/icons/icon-512x512.png'
        }
    };

    const options = {
        vapidDetails: {
            subject: process.env.VAPID_MAILTO,
            publicKey: process.env.VAPID_PUBLIC_KEY,
            privateKey: process.env.VAPID_PRIVATE_KEY,
        },
        TTL: 60,
    };

    // send notification
    webpush.sendNotification(subscription, JSON.stringify(payload), options)
    .then((_) => {
        console.log('SENT!!!');
        console.log(_);
    })
    .catch((_) => {
        console.log(_);
    });
};

async function getSubscriptions(uuid) {
    let query = `SELECT * FROM pushnotifications WHERE user_uuid = '${uuid}'`;
    let data = await new Promise((resolve, reject) => {
        mindmapDB.query(query, (err, results, fields) => {
        if (err) reject(err);
            resolve(results);
        });
    }).catch((err) => {
        throw err;
    });
    return data;
};

module.exports = { sendNotification, getSubscriptions };