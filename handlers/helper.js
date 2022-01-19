const gcm = require("node-gcm");
const mysql = require("../public/javascripts/mysql/mysql");
const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const webpush = require("web-push");

module.exports = (function () {
  //for demo server
  const vapidKeys = {
    publicKey:
      "BG4nDxMHBPV4YtkBZoGjPSOWDPrbyzw-o-vDKaScPhYfAjQs1hclQLwNWKKHYHNut0GZoVyj0jONVZgA5Dzdq0U",
    privateKey: "SuA1XssVFT4UfSv8DEGx_uRkng2YtEUVxj54729zXkM",
    mailTo: "mailto:support@intelehealth.org",
  };
  // For testing server
  // const vapidKeys = {
  //     publicKey:
  //         "BAfolLQ7VpRSmWm6DskG-YyG3jjzq5z0rjKEl5HXLCw2W8CKS9cVmifnCAWnrlJMETgbgjuV1pWKLUf8zlbojH0",
  //     privateKey: "kCDISA3-UoW0pEx_gSTm4VtQASbvza-uw27Mq1x2wEc",
  //     mailTo: "mailto:support@intelehealth.org"
  // };
  webpush.setVapidDetails(
    vapidKeys.mailTo,
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  this.sendWebPushNotificaion = async ({ webpush_obj, title, body }) => {
    await webpush
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
