const gcm = require("node-gcm");
const mysql = require("../public/javascripts/mysql/mysql");
const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const webpush = require("web-push");
const axios = require("axios");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];

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
  }) => {
    await webpush
      .sendNotification(
        JSON.parse(webpush_obj),
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
        console.log("notification:", error.body);
        console.log("status code: ", error.statusCode);
        console.log("--------------------------------------------------------");
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
    android = {},
    webpush = {},
    apns = {},
    click_action = "FCM_PLUGIN_HOME_ACTIVITY",
  }) => {
    var sender = new gcm.Sender(
      "AAAAteo0mXw:APA91bHKDO9T4O2sbk_sjYRkabN8F8MR0Gegv5H-Pa7VR-zoGp5GeYTztpac96Awy2F5FT0c09PZM5ryv2yXEcGZy8zwkQmujtJgMXDlHBjUcM0vDFHbOAK4SZ8jKDMzz-OGzm5TzfA0"
    );

    var message = new gcm.Message({
      data,
      notification: {
        title,
        icon,
        body,
        click_action,
      },
      android: {
        ttl: "30s",
        priority: "high",
      },
      webpush: {
        headers: {
          TTL: "30",
          Urgency: "high",
        },
      },
      apns: {
        headers: {
          "apns-priority": "5",
        },
      },
    });

    return new Promise((res, rej) => {
      sender.send(
        message,
        { registrationTokens: regTokens },
        function (err, response) {
          if (err) {
            console.log("err: ", err);
            console.error(err);
            rej(err);
          } else {
            console.log(response);
            res(response);
          }
        }
      );
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
          console.log("err: ", err);
          reject(err.message);
        }
        resolve(results);
      });
    });
  };

  return this;
})();
