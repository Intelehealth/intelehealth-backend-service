const gcm = require("node-gcm");
const mysql = require("../public/javascripts/mysql/mysql");
const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const webpush = require("web-push");
const axios = require("axios");
const admin = require("firebase-admin");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];

const serviceAccount = require(__dirname + "/../config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://intelehealth-ekalarogya.firebaseio.com",
});

module.exports = (function () {
  const vapidKeys = {
    publicKey:
      "BHkKl1nW4sC_os9IRMGhrSZ4JJp0RHl2_PxTdV_rElOjnHe-dq1hx2zw_bTgrkc4ulFD-VD4x6P63qN1Giroe7U",
    privateKey: "YAL9dkVltWw5qj_nYg2zQFQe4viFysX89xxTV6aPRk8",
    mailTo: "mailto:support@intelehealth.org",
  };
  // For ekal afi prod server
  // const vapidKeys = {
  //   publicKey:
  //     "BO4jQA2_cu-WSdDY0HCbB9OKplPYpCRvjDwmjEPQd7K7m1bIrtjeW7FXCntUUkm2V0eAKh9AGKqmpR4-_gYSYX8",
  //   privateKey: "ghU6K-grKvUMVdEmqNBoiM0olBsxD3FCpm2QDa8eR_U",
  //   mailTo: "mailto:support@intelehealth.org",
  // };
  webpush.setVapidDetails(
    vapidKeys.mailTo,
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  const baseURL = `https://${config.domain}`;

  this.axiosInstance = axios.create({
    baseURL,
    timeout: 50000,
    headers: { Authorization: "Basic c3lzbnVyc2U6SUhOdXJzZSMx" },
  });

  this.sendWebPushNotificaion = async ({
    webpush_obj,
    title,
    body,
    options = {},
    isObject = false,
  }) => {
    await webpush
      .sendNotification(
        isObject ? webpush_obj : JSON.parse(webpush_obj),
        JSON.stringify({
          notification: {
            title,
            body,
            vibrate: [100, 50, 100],
          },
        }),
        options
      )
      .catch((error) => {
        this.log("notification:", error.body);
        this.log("status code: ", error.statusCode);
        this.log("--------------------------------------------------------");
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

  this.RES = (res, data, statusCode = 200) => {
    res.status(statusCode).json(data);
  };

  this.asyncForEach = async function (array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  };

  this.getDataFromQuery = (query, openMrs = false) => {
    const db = openMrs ? openMrsDB : mysql;
    return new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) {
          this.log("err: ", err);
          reject(err.message);
        }
        resolve(results);
      });
    });
  };

  this.log = (...params) => {
    if (config && config.debug) {
      console.log(...params);
    }
  };

  this.getFirebaseAdmin = () => {
    return admin;
  };

  this.generateUUID = () => {
    let d = new Date().getTime();
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      d += performance.now(); //use high-precision timer if available
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        let r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }
    );
  };

  return this;
})();
