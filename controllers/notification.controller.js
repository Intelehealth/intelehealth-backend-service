const mysql = require("../public/javascripts/mysql/mysql");

Date.prototype.addMinutes = function (m) {
  this.setTime(this.getTime() + m * 60000);
  return this;
};

Date.prototype.addHours = function (h) {
  this.setTime(this.getTime() + h * 60 * 60 * 1000);
  return this;
};

const setSnoozeToDBb = async (user_uuid, snooze_till) => {
  return await new Promise((resolve, reject) => {
    mysql.query(
      "Insert into user_settings SET ?",
      { user_uuid, snooze_till },
      (err, results, fields) => {
        if (err) res.status(400).json({ message: err.message });
        resolve("Snoozed successfully!");
      }
    );
  });
};

const removeUserSnooze = async (user_uuid) => {
  return await new Promise((resolve, reject) => {
    mysql.query(
      `DELETE from user_settings where user_uuid='${user_uuid}'`,
      (err, results, fields) => {
        if (err) res.status(400).json({ message: err.message });
        resolve(results);
      }
    );
  });
};

const snoozeNotification = async ({ body }, res) => {
  try {
    let snooze_till = "";
    let resp = {};
    let statusCode = 200;
    if (!body.user_uuid)
      res.status(422).json({ message: "Please pass correct user uuid!" });

    await removeUserSnooze(body.user_uuid);

    switch (body.snooze_for) {
      case "30m":
        snooze_till = new Date().addMinutes(30).valueOf();
        resp = {
          snooze_till,
          message: await setSnoozeToDBb(body.user_uuid, snooze_till),
        };
        break;
      case "1h":
        snooze_till = new Date().addHours(1).valueOf();
        resp = {
          snooze_till,
          message: await setSnoozeToDBb(body.user_uuid, snooze_till),
        };
        break;
      case "2h":
        snooze_till = new Date().addHours(2).valueOf();
        resp = {
          snooze_till,
          message: await setSnoozeToDBb(body.user_uuid, snooze_till),
        };
        break;
      case "off":
        resp = {
          snooze_till: "",
          message: await setSnoozeToDBb(body.user_uuid, snooze_till),
        };
        break;
      default:
        {
          statusCode = 422;
          resp = {
            message: "Please pass correct snooze_for!",
          };
        }
        break;
    }
    res.status(statusCode).json(resp);
  } catch (err) {
    console.log("error:snoozeNotification ", err);
    res.status(500).json({
      message: err.message || "Something went wrong with the request",
    });
  }
};

module.exports = {
  snoozeNotification,
};
