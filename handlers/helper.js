const mysql = require("../public/javascripts/mysql/mysql");
const webpush = require("web-push");
const admin = require("firebase-admin");

const {
  FIREBASE_SERVICE_ACCOUNT_KEY,
  FIREBASE_DB_URL,
  VAPID_MAILTO,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  DEBUG
} = process.env;

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY)),
  databaseURL: FIREBASE_DB_URL,
});

webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

module.exports = (function () {
  this.sendWebPushNotification = async ({
    webpush_obj,
    title,
    body,
    data = {},
    parse = false,
  }) => {
    try {
      webpush
      .sendNotification(
        parse ? JSON.parse(webpush_obj) : webpush_obj,
        JSON.stringify({
          notification: {
            title,
            body,
            vibrate: [100, 50, 100],
            data
          },
        })
      )
      .catch((error) => {
        console.log("appointment notification error", error);
      });
    } catch (e) {
      console.error("Error when sending notification", error);
    }
    
  };

  this.validateParams = (params, keysAndTypeToCheck = []) => {
    try {
      keysAndTypeToCheck.forEach((obj) => {
        if (!params[obj.key] && typeof params[obj.key] !== obj.type) {
          if (!params[obj.key]) {
            throw `Invalid request, ${obj.key} is missing.`;
            return false;
          }
          if (!params[obj.key]) {
            throw `Wrong param type for ${obj.key}(${typeof params[
              obj.key
            ]}), required type is ${obj.type}.`;
            return false;
          }
        }
      });
      return true;
    } catch (error) {
      throw error;
    }
  };

  
/**
 * Send cloud notification using fcm
 * @param {*} data - (title, body, icon, data(payload), regTokens, click_action)
 */
  this.sendCloudNotification = async ({
    title,
    body,
    icon = "ic_launcher",
    data = {},
    regTokens,
    click_action = "FCM_PLUGIN_HOME_ACTIVITY",
  }) => {
    const messaging = admin.messaging();
    const payload = {
      data,
      // notification: { //TODO: removed this as per comment IDA4-3303
      //   title,
      //   icon,
      //   body,
      //   click_action,
      // },
    };

    const options = {
      priority: "high",
    };

    try {
      const result = await messaging.sendToDevice(regTokens, payload, options);
    } catch (err) {
      console.error("Cloud notification error:", err);
    }
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

  this.log = (...params) => {
    if (DEBUG === 'true') {
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
