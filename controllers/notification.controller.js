const mysql = require("../public/javascripts/mysql/mysql");
const { user_settings } = require("../models");
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
        if (err) {
          console.log("err: ", err);
          reject(err.message);
        }
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
    const type = body.custom ? "custom" : body.snooze_for;
    let snooze_till = "";
    let resp = {};
    let statusCode = 200;
    if (!body.user_uuid)
      res.status(422).json({ message: "Please pass correct user uuid!" });

    await removeUserSnooze(body.user_uuid);

    switch (type) {
      case "30m":
        snooze_till = new Date().addMinutes(30).valueOf();
        resp = {
          snooze_till: snooze_till - new Date().valueOf(),
          message: await setSnoozeToDBb(body.user_uuid, snooze_till),
        };
        break;
      case "1h":
        snooze_till = new Date().addHours(1).valueOf();
        resp = {
          snooze_till: snooze_till - new Date().valueOf(),
          message: await setSnoozeToDBb(body.user_uuid, snooze_till),
        };
        break;
      case "2h":
        snooze_till = new Date().addHours(2).valueOf();
        resp = {
          snooze_till: snooze_till - new Date().valueOf(),
          message: await setSnoozeToDBb(body.user_uuid, snooze_till),
        };
        break;

      case "custom": {
        let message;
        try {
          message = await setSnoozeToDBb(body.user_uuid, body.snooze_for);
        } catch (error) {
          message = error.message;
        }
        resp = {
          snooze_till: type,
          message,
        };
        break;
      }

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

const getSettings = async (uuid) => {
<<<<<<< HEAD
    return new Promise((resolve, reject) => {
        mysql.query(
            `select * from user_settings where user_uuid='${uuid}' LIMIT 0 , 1`,
            (err, results, fields) => {
                if (err) {
                    console.log('err: ', err);
                    res.status(400).json({ message: err.message });
                    reject(err);
                }
                resolve(results[0]);
            }
        );
    });
=======
  return new Promise((resolve, reject) => {
    mysql.query(
      `select * from user_settings where user_uuid='${uuid}' LIMIT 0 , 1`,
      (err, results, fields) => {
        if (err) reject(err);
        resolve(results[0]);
      }
    );
  });
>>>>>>> 353119a68602bb4de3ead31b38d111765e0bd238
};

const getUserSettings = async ({ params }, res) => {
  if (!params.uuid)
    res.status(422).json({ message: "Please pass correct user uuid!" });

  let data = await user_settings.findOne({
    where: { user_uuid: params.uuid },
  });
  if (!data) data = {};
  res.status(200).json({
    message: "Settings recevied successfully.",
    data,
    snooze_till:
      data && data.snooze_till ? data.snooze_till - new Date().valueOf() : "",
  });
};

const setUserSettings = async ({ body }, res) => {
  if (!body.user_uuid)
    res.status(422).json({ message: "Please pass correct user uuid!" });

<<<<<<< HEAD
    const data = await getSettings(params.uuid);
    res.status(200).json({
        message: "Settings received successfully.",
        data: {
            snooze_till:
                data && data.snooze_till ? data.snooze_till - new Date().valueOf() : "",
            isChange: data && data.isChangePassword ? data.isChangePassword : 0
        },
=======
  let data = await user_settings.findOne({
    where: { user_uuid: body.user_uuid },
  });
  let dataToUpdate = { ...body.data };
  if (data) {
    delete dataToUpdate.user_uuid;
    data = await data.update(dataToUpdate);
  } else {
    data = await user_settings.create({
      ...dataToUpdate,
      user_uuid: body.user_uuid,
      snooze_till: "",
>>>>>>> 353119a68602bb4de3ead31b38d111765e0bd238
    });
  }
  res.status(200).json({
    message: data
      ? "Settings saved successfully."
      : "Data not found with this user uuid.",
    data,
  });
};




module.exports = {
  snoozeNotification,
  getUserSettings,
  setUserSettings,
};
