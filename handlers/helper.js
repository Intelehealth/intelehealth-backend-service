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

  return this;
})();
