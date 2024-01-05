const { user_settings } = require("../models");
const { RES } = require("../handlers/helper");
const { MESSAGE } = require("../constants/messages");

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
  const { uuid } = params;
  if (!uuid)
    res.status(422).json({ message: "Please pass correct user uuid!" });

  let data = await user_settings.findOne({
    where: { user_uuid: uuid },
  });
  if (!data) data = {};
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
  if (!body.user_uuid)
    res.status(422).json({ message: MESSAGE.NOTIFICATION.PLEASE_PASS_CORRECT_USER_UUID });

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
        { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null }, 
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

/**
 * Request for update the notification status to user settings.
 * @param {request} req
 * @param {response} res
 */
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
          message: MESSAGE.NOTIFICATION.NOTIFICATION_STATUS_CHANGED_SUCCESSFULLY,
          data: { notification_status: user.notification }
        },
        200
      );
    } else {
      RES(
        res, 
        { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null }, 
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

/**
 * Request for update the snooze time of the notification to user settings.
 * @param {request} req
 * @param {response} res
 */
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
            message: MESSAGE.NOTIFICATION.NOTIFICATION_SNOOZED_SUCCESSFULLY,
            data: { snooze_till }
          },
          200
        );
      } else {
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
      RES(
        res, 
        { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null }, 
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
