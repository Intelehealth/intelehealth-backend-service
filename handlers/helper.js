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
      "AAAAteo0mXw:APA91bEsp3WC170iQTmR7GnAJNh7skYgP171klh_Ae2dd2MUmEwZMJaUKZIayOQSDJ7DI-DJkZYtu-E8RNKGbJMOhAlUi3kqhXgPBEf0wYWX1u04YxQcSCn-8o8YRSZavldn3JIxLGL5"
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
