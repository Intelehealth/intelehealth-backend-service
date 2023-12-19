const mysql = require("../public/javascripts/mysql/mysql");
const { user_settings } = require("../models");
const { RES } = require("../handlers/helper");
const { NOTIFICATION, COMMON } = require("../constants/messages");

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
          reject(err.message);
        }
        resolve(NOTIFICATION.SNOOZED_SUCCESSFULLY);
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

// const snoozeNotification = async ({ body }, res) => {
//   try {
//     const type = body.custom ? "custom" : body.snooze_for;
//     let snooze_till = "";
//     let resp = {};
//     let statusCode = 200;
//     if (!body.user_uuid)
//       res.status(422).json({ message: "Please pass correct user uuid!" });

//     await removeUserSnooze(body.user_uuid);

//     switch (type) {
//       case "30m":
//         snooze_till = new Date().addMinutes(30).valueOf();
//         resp = {
//           snooze_till: snooze_till - new Date().valueOf(),
//           message: await setSnoozeToDBb(body.user_uuid, snooze_till),
//         };
//         break;
//       case "1h":
//         snooze_till = new Date().addHours(1).valueOf();
//         resp = {
//           snooze_till: snooze_till - new Date().valueOf(),
//           message: await setSnoozeToDBb(body.user_uuid, snooze_till),
//         };
//         break;
//       case "2h":
//         snooze_till = new Date().addHours(2).valueOf();
//         resp = {
//           snooze_till: snooze_till - new Date().valueOf(),
//           message: await setSnoozeToDBb(body.user_uuid, snooze_till),
//         };
//         break;

//       case "custom": {
//         let message;
//         try {
//           message = await setSnoozeToDBb(body.user_uuid, body.snooze_for);
//         } catch (error) {
//           message = error.message;
//         }
//         resp = {
//           snooze_till: type,
//           message,
//         };
//         break;
//       }

//       case "off":
//         resp = {
//           snooze_till: "",
//           message: await setSnoozeToDBb(body.user_uuid, snooze_till),
//         };
//         break;
//       default:
//         {
//           statusCode = 422;
//           resp = {
//             message: "Please pass correct snooze_for!",
//           };
//         }
//         break;
//     }
//     res.status(statusCode).json(resp);
//   } catch (err) {
//     res.status(500).json({
//       message: err.message || "Something went wrong with the request",
//     });
//   }
// };

const getSettings = async (uuid) => {
  return new Promise((resolve, reject) => {
    mysql.query(
      `select * from user_settings where user_uuid='${uuid}' LIMIT 0 , 1`,
      (err, results, fields) => {
        if (err) reject(err);
        resolve(results[0]);
      }
    );
  });
};

const getUserSettings = async ({ params }, res) => {
  if (!params.uuid)
    res.status(422).json({ message: "Please pass correct user uuid!" });

  let data = await user_settings.findOne({
    where: { user_uuid: params.uuid },
  });
  if (!data) data = {};
  res.status(200).json({
    message: NOTIFICATION.SETTINGS_RECEVIED_SUCCESSFULLY,
    data,
    snooze_till:
      data && data.snooze_till ? data.snooze_till - new Date().valueOf() : "",
  });
};

const setUserSettings = async ({ body }, res) => {
  if (!body.user_uuid)
    res.status(422).json({ message: NOTIFICATION.PLEASE_PASS_CORRECT_USER_UUID });

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
    });
  }
  res.status(200).json({
    message: data
      ? NOTIFICATION.SETTINGS_SAVED_SUCCESSFULLY
      : NOTIFICATION.DATA_NOT_FOUND_WITH_THIS_USER_UUID,
    data,
  });
};

const getNotificationStatus = async ( req, res) => {
  try {
    const { uuid } = req.params;
    if (uuid) {
      let user = await user_settings.findOne({
        where: {
          user_uuid: uuid,
        },
      });
      if (user) {
        if ((user.snooze_till - new Date().valueOf()) <= 0) {
          user.snooze_till = '';
          await user.save();
        }
      } else {
        user = await user_settings.create({
          user_uuid: uuid,
          notification: 1,
          snooze_till: ''
        });
      }
      RES(
        res,
        {
          success: true,
          message: 'Notification status retrieved successfully!',
          data: { 
            notification_status: user.notification, 
            snooze_till: user.snooze_till 
          }
        },
        200
      );
    } else {
      RES(
        res, 
        { success: false, message: COMMON.BAD_REQUEST, data: null }, 
        400
      );
    }
  } catch (error) {
    if (error.code === null || error.code === undefined) {
      error.code = 500;
    }
    RES(
      res,
      { success: false, data: error.data, message: error.message },
      error.code
    );
  }
};

const toggleNotificationStatus = async ( req, res) => {
  try {
    const { uuid } = req.params;
    if (uuid) {
      let user = await user_settings.findOne({
        where: {
          user_uuid: uuid,
        },
      });
      if (user) {
        user.notification = (user.notification) ? 0 : 1;
        user.snooze_till = "";
        await user.save();
      } else {
        user = await user_settings.create({
          user_uuid: uuid,
          notification: 1
        });
      }
      RES(
        res,
        {
          success: true,
          message: NOTIFICATION.NOTIFICATION_STATUS_CHANGED_SUCCESSFULLY,
          data: { notification_status: user.notification }
        },
        200
      );
    } else {
      RES(
        res, 
        { success: false, message: COMMON.BAD_REQUEST, data: null }, 
        400
      );
    }
  } catch (error) {
    if (error.code === null || error.code === undefined) {
      error.code = 500;
    }
    RES(
      res,
      { success: false, data: error.data, message: error.message },
      error.code
    );
  }
};

const snoozeNotification = async ( req, res) => {
  try {
    const { uuid } = req.params;
    const { snooze_for } = req.body;

    if (uuid && snooze_for) {
      let user = await user_settings.findOne({
        where: {
          user_uuid: uuid,
        },
      });
      if (user) {
        let snooze_till = new Date().valueOf();
        switch (snooze_for) {
          case '30m':
            snooze_till = new Date().addMinutes(30).valueOf();
            break;
          case '1h':
            snooze_till = new Date().addHours(1).valueOf();
            break;
          case '2h':
            snooze_till = new Date().addHours(2).valueOf();
            break;
          case 'off':
            snooze_till = '';
            break;
          default:
            break;
        }
        user.snooze_till = snooze_till;
        await user.save();
        RES(
          res,
          {
            success: true,
            message: NOTIFICATION.NOTIFICATION_SNOOZED_SUCCESSFULLY,
            data: { snooze_till }
          },
          200
        );
      } else {
        RES(
          res,
          {
            success: false,
            message: COMMON.USER_NOT_EXIST,
            data: null
          },
          200
        );
      }
      
    } else {
      RES(
        res, 
        { success: false, message: COMMON.BAD_REQUEST, data: null }, 
        400
      );
    }
  } catch (error) {
    if (error.code === null || error.code === undefined) {
      error.code = 500;
    }
    RES(
      res,
      { success: false, data: error.data, message: error.message },
      error.code
    );
  }
};

module.exports = {
  snoozeNotification,
  getUserSettings,
  setUserSettings,
  getNotificationStatus,
  toggleNotificationStatus
};
