const gcm = require("node-gcm");
const mysql = require("../public/javascripts/mysql/mysql");
const webpush = require("web-push");

module.exports = (function () {
  const vapidKeys = {
    publicKey:
    "BJJvSw6ltFPN5GDxIOwbRtJUBBJp2CxftaRNGbntvE0kvzpe05D9zKr-SknKvNBihXDoyd09KuHrWwC3lFlTe54",
    privateKey: "7A59IAQ78P3qbnLL0uICspWr2BJ8II1FnxTatMNelkI",
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
    android = {},
    webpush = {},
    apns = {},
    click_action = "FCM_PLUGIN_HOME_ACTIVITY",
  }) => {
    var sender = new gcm.Sender(
      "AAAA0DrNJRk:APA91bEw_sr5MiqExwmu0ejp9wvEvDiTiWuJqOzMG0NWrAp0V1ULcTKfI46XZ5xyVeTfb3Ub07hR9ssMa1Z5fpggqT4x3MFlzs5fcAHAHaxTwbmM8W789EzmDPFXuIjxyQMXI0Kte9DQ"
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

  return this;
})();
