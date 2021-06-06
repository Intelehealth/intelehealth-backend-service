const gcm = require("node-gcm");

module.exports = (function () {
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
    type = "Patient",
  }) => {
    const patientAppKey =
      "AAAA72UbkIc:APA91bGlhIqIfcWSGRl9z8J5X5bEd-3VEYFtI8w5ViLM2b74sMRlLdzQmIEvNRfatgVXuaLLAXJRT7o-RFYBPl51NTbPNbEEfcFv7R3d-XaNiQIU__Gzwr7lfOzHlOFgF9GTRq4M1krt";
    const nurseAppKey =
      "AAAAFO3cJb4:APA91bErE4LKKdJwdPcVqGhkyxon2dsI-eUo9Nay91_FYi4B9dBOEbCAoU7IddKXRT2XOjUjKgCCEPkEBCu_UtwA-E-GBS1FDnvf_x-4DtLRmSvaKmq1ifNJDJpdKIsFSVDx9OG2iGGX";
    if (["Nurse", "nurse"].includes(type)) {
      serverKey = nurseAppKey;
    } else {
      serverKey = patientAppKey;
    }

    var sender = new gcm.Sender(serverKey);

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
  return this;
})();
