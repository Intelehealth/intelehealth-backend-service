const { user_settings } = require("../models");
const { RES, sendPrescriptionCloudNotification } = require("../handlers/helper");
const { MESSAGE } = require("../constants/messages");
const { logStream } = require("../logger/index");
const { createNotification, readNotificationById, deleteNotifications, getNotifications} = require("../services/notifications.service");
const { getPagingData } = require("../handlers/functions");
Date.prototype.addMinutes = function (m) {
  this.setTime(this.getTime() + m * 60000);
  return this;
};

Date.prototype.addHours = function (h) {
  this.setTime(this.getTime() + h * 60 * 60 * 1000);
  return this;
};

/**
 * Return Requested user settings.
 * @param {request} req
 * @param {response} res
 */
const getUserSettings = async ({ params }, res) => {
  logStream('debug', 'API call', 'Get Link');
  const { uuid } = params;
  if (!uuid)
    res.status(422).json({ message: "Please pass correct user uuid!" });

  let data = await user_settings.findOne({
    where: { user_uuid: uuid },
  });
  if (!data) data = {};
  logStream('debug', 'Success', 'Create Short Link');
  res.status(200).json({
    message: MESSAGE.NOTIFICATION.SETTINGS_RECEVIED_SUCCESSFULLY,
    data,
    snooze_till:
      data && data.snooze_till ? data.snooze_till - new Date().valueOf() : "",
  });
};

/**
 * Request for update or set the user settings.
 * @param {request} req
 * @param {response} res
 */
const setUserSettings = async ({ body }, res) => {
  logStream('debug', 'API call', 'Get Link');
  if (!body.user_uuid)
    res.status(422).json({ message: MESSAGE.NOTIFICATION.PLEASE_PASS_CORRECT_USER_UUID });

  let data = await user_settings.findOne({
    where: { user_uuid: body.user_uuid },
  });
  const dataToUpdate = { ...body.data };
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
  logStream('debug', 'Success', 'Get Link');
  res.status(200).json({
    message: data
      ? MESSAGE.NOTIFICATION.SETTINGS_SAVED_SUCCESSFULLY
      : MESSAGE.NOTIFICATION.DATA_NOT_FOUND_WITH_THIS_USER_UUID,
    data,
  });
};

/**
 * Request for get notification status from user settings.
 * @param {request} req
 * @param {response} res
 */
const getNotificationStatus = async (req, res) => {
  try {
    logStream('debug', 'API call', 'Get Notification Status');
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
      logStream('debug', 'Success', 'Get Notification Status');
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
      logStream('debug', 'Bad Request', 'Get Notification Status');
      RES(
        res,
        { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null },
        400
      );
    }
  } catch (error) {
    logStream("error", error.message);
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

/**
 * Request for update the notification status to user settings.
 * @param {request} req
 * @param {response} res
 */
const toggleNotificationStatus = async (req, res) => {
  try {
    logStream('debug', 'API call', 'Toggle Notification Status');
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
      logStream('debug', 'Success', 'Toggle Notification Status');
      RES(
        res,
        {
          success: true,
          message: MESSAGE.NOTIFICATION.NOTIFICATION_STATUS_CHANGED_SUCCESSFULLY,
          data: { notification_status: user.notification }
        },
        200
      );
    } else {
      logStream('debug', 'Bad Request', 'Toggle Notification Status');
      RES(
        res,
        { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null },
        400
      );
    }
  } catch (error) {
    logStream("error", error.message);
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

/**
 * Request for update the snooze time of the notification to user settings.
 * @param {request} req
 * @param {response} res
 */
const snoozeNotification = async (req, res) => {
  try {
    logStream('debug', 'API call', 'Snooze Notification');
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
        logStream('debug', 'Success', 'Snooze Notification');
        RES(
          res,
          {
            success: true,
            message: MESSAGE.NOTIFICATION.NOTIFICATION_SNOOZED_SUCCESSFULLY,
            data: { snooze_till }
          },
          200
        );
      } else {
        logStream('debug', 'No Such User Exists', 'Snooze Notification');
        RES(
          res,
          {
            success: false,
            message: MESSAGE.COMMON.USER_NOT_EXIST,
            data: null
          },
          200
        );
      }

    } else {
      logStream('debug', 'Bad Request', 'Snooze Notification');
      RES(
        res,
        { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null },
        400
      );
    }
  } catch (error) {
    logStream("error", error.message);
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

const notifyApp = async (req, res, next) => {
  try {
    logStream('debug', 'API call', 'Notify App');
    let userSetting = await user_settings.findOne({
      where: { user_uuid: req.params.userId },
    });
    let data = null;

    if (userSetting?.device_reg_token) {
      let notficationObj = {
        title: req.body.title,
        body: req.body.body,
        regTokens: [userSetting?.device_reg_token],
      };
      if (req.body.data) notficationObj.data = req.body.data;
     
      data = await sendPrescriptionCloudNotification(notficationObj)
        .then((res) => {
          createNotification({
            user_uuid: req.params.userId,
            title: notficationObj.title,
            description: notficationObj.body,
            payload: notficationObj
          })
        })
        .catch((err) => {
          logStream("error", err.message);
        });
    }
    logStream('debug', `Success`, 'Notify App');
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

const acknowledgeNotification = async (req ,res, next) => {
  logStream('debug', 'API call', 'Acknowledge Notification');
  const { id } = req.params;
  if (!id)
    res.status(422).json({ message: "Please pass correct notification id!" });

  let data = await readNotificationById(id);
  if (data.data && data.data[0] === 0) 
    res.status(503).json({ message: "Record not present" });
  else{
    logStream('debug', 'Success', 'Acknowledge Notification');
    res.status(200).json({
      message: "Acknowledged Notification Successfully",
      data
    });
  }
}

const clearNotification = async(req, res, next) => {
  logStream('debug', 'API call', 'Clear Notification');
  const { userId } = req.params;
  if (!userId)
    res.status(422).json({ message: "Please pass correct user id!" });

  let data = await deleteNotifications(userId);
  if (!data.data) 
    res.status(503).json({ message: "Records not present" });
  else{ 
    logStream('debug', 'Success', 'Clear Notification');
    res.status(200).json({
      message: "Clear Notification Successfully",
      data
    });
  }
}

const listNotifications = async (req, res, next) => {
  logStream('debug', 'API call', 'All Notification');
  const { userId, page = 1, size = 10 } = req.query;
  if (!userId) {
    res.status(422).json({ message: "Please pass correct user id!" });
    return;
  }
  try {
    const offset = (page - 1) * size;
    const data = await getNotifications({ userUuid: userId }, offset, +size);
    logStream('debug', 'Success', 'All Notification');
    return res.status(200).json(getPagingData(data, page, size));
  } catch (error) {
    next(error)
  }
}

module.exports = {
  snoozeNotification,
  getUserSettings,
  setUserSettings,
  getNotificationStatus,
  toggleNotificationStatus,
  notifyApp,
  acknowledgeNotification,
  clearNotification,
  listNotifications
};
