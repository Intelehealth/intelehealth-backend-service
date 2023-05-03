const mysql = require("../public/javascripts/mysql/mysql");
const webpush = require("web-push");
const admin = require("firebase-admin");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];

const serviceAccount = require(__dirname + "/../config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://nashik-arogya-sampada-master-default-rtdb.asia-southeast1.firebasedatabase.app",
});

module.exports = (function () {
  const vapidKeys = {
    publicKey:
      "BJPw_8oVG_SU7Tyfj-Od3zhgMmfC3ElvKLG37iYJhWtWElqz929WWLkZjR410YkA4cywJF7K0QwOGWWLWw03MPY",
    privateKey: "d0oUbsVoSXowtzvit3VsMC_VKLvcMkdVVeyegdqxauU",
    mailTo: "mailto:support@intelehealth.org",
  };
  webpush.setVapidDetails(
    vapidKeys.mailTo,
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

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
