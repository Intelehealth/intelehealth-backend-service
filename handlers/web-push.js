const webpush = require('web-push');
const mindmapDB = require("../public/javascripts/mysql/mysql");

async function sendNotification(subscription, title, body) {
    const vapidKeys = {
        publicKey: "BM4tUVW1UwkMpfAWh2mwhA-wwdIC2rCF1MFypbFpjn23qYMQXaeAaYi6ydGslRb_Vdr2Ws0MW5RSUH9InEbYNhA",
        privateKey: "2x0DTVhRpzAaBfbcdWJNrBk7yTTE2gJivTavfLjQXhY"
    };

    const payload = {
        notification: {
            title,
            body,
            icon: 'assets/icons/icon-512x512.png'
        }
    };

    const options = {
        vapidDetails: {
            subject: 'mailto: <support@intelehealth.org>',
            publicKey: vapidKeys.publicKey,
            privateKey: vapidKeys.privateKey,
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
    let query = `SELECT * FROM pushnotification WHERE user_uuid = '${uuid}'`;
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