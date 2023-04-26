const webpush = require('web-push');
const mindmapDB = require("../public/javascripts/mysql/mysql");

async function sendNotification(subscription, title, body) {
    const vapidKeys = {
        publicKey: 'BANxSWzoJW3mjQn49eDQRKjtnXCt6F98Df9XrxfDsT71KYKE8LpcW67-OIt1v4lAlm4GWZwjS1OvQBjyJ6r8Z7A',
        privateKey: '5F_hiGmg_nxirKFENd9GwYrzymxhEXYffOGIKAx_C3I'
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