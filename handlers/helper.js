// const gcm = require("node-gcm");
const mysql = require("../public/javascripts/mysql/mysql");
const webpush = require("web-push");
const axios = require("axios");
const admin = require("firebase-admin");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];
const serviceAccount = require(__dirname + "/../config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ezazi-8712a-default-rtdb.firebaseio.com",
});

module.exports = (function () {
  const vapidKeys = {
    /** web push keys for  - https://ezazi.intelehealth.org */
    publicKey:
      "BLDLmm1FrOhRJsumFL3lZ8fgnC_c1rFoNp-mz6KWObQpgPkhWzUh66GCGPzioTWBc4u0SB8P4spimU8SH2eWNfg",
    privateKey: "ziCGVBiegKF4tTYxp1ruG3xgrDJ3mcC31Euxpekxsto",
    mailTo: "mailto:support@intelehealth.org",
  };

  webpush.setVapidDetails(
    vapidKeys.mailTo,
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  const baseURL = `https://${config.domain}`;

  this.axiosInstance = axios.create({
    baseURL,
    timeout: 50000,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.openMrsUsername}:${config.openMrsPassword}`
      ).toString("base64")}`,
    },
  });

  this.sendWebPushNotificaion = async ({ webpush_obj, title, body }) => {
    webpush
      .sendNotification(
        JSON.parse(webpush_obj),
        JSON.stringify({
          notification: {
            title,
            body,
            vibrate: [100, 50, 100],
          },
        })
      )
      .catch((error) => {
        console.log("appointment notification error", error);
      });
  };

  this.validateParams = (params, keysAndTypeToCheck = []) => {
    try {
      keysAndTypeToCheck.forEach((obj) => {
        if (!params[obj.key] && typeof params[obj.key] !== obj.type) {
          if (!params[obj.key]) {
            throw new Error(`Invalid request, ${obj.key} is missing.`);
          }
          if (!params[obj.key]) {
            throw new Error(
              `Wrong param type for ${obj.key}(${typeof params[
                obj.key
              ]}), required type is ${obj.type}.`
            );
          }
        }
      });
      return true;
    } catch (error) {
      throw error;
    }
  };

  this.sendCloudNotification = async ({
    title,
    body,
    icon = "ic_launcher",
    data = {},
    regTokens,
    click_action = "FCM_PLUGIN_HOME_ACTIVITY",
  }) => {
    const admin = this.getFirebaseAdmin();
    const messaging = admin.messaging();

    var payload = {
      data,
      notification: {
        title,
        icon,
        body,
        click_action,
      },
    };

    const options = {
      priority: "high",
    };

    return messaging
      .sendToDevice(regTokens, payload, options)
      .then((result) => {
        console.log(result);
      })
      .catch((err) => {
        console.log("err: ", err);
      });
  };

  this.getFirebaseAdmin = () => {
    return admin;
  };

  this.RES = (res, data, statusCode = 200) => {
    res.status(statusCode).json(data);
  };

  this.asyncForEach = async function (array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  };

  this.getDataFromQuery = (query) => {
    return new Promise((resolve, reject) => {
      mysql.query(query, (err, results) => {
        if (err) {
          console.log("err: ", err);
          reject(err.message);
        }
        resolve(results);
      });
    });
  };

  this.generateHash = (length) => {
    return Math.round(
      Math.pow(36, length + 1) - Math.random() * Math.pow(36, length)
    )
      .toString(36)
      .slice(1);
  };

  return this;
})();
