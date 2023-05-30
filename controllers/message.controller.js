const { sendMessage, getMessages } = require("../services/message.service");
const {
  validateParams,
  sendWebPushNotificaion,
} = require("../handlers/helper");
const { user_settings, pushnotification } = require("../models");

module.exports = (function () {
  /**
   * Method to create message entry and transmit it to socket on realtime
   * @param {*} req
   * @param {*} res
   */
  this.sendMessage = async (req, res) => {
    const { fromUser, toUser, patientId, message } = req.body;
    const keysAndTypeToCheck = [
      { key: "fromUser", type: "string" },
      { key: "toUser", type: "string" },
      { key: "patientId", type: "string" },
      { key: "message", type: "string" },
    ];
    let isLiveMessageSent = false;
    try {
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await sendMessage(fromUser, toUser, patientId, message);
        for (const key in users) {
          if (Object.hasOwnProperty.call(users, key)) {
            const user = users[key];
            if (user && user.uuid == toUser) {
              try {
                data.data.dataValues.createdAt = new Date(
                  data.data.dataValues.createdAt
                ).toGMTString();
              } catch (error) {}
              io.to(key).emit("updateMessage", data.data);
              isLiveMessageSent = true;
            }
          }
        }
        let notificationResponse = "";
        if (!isLiveMessageSent) {
          const userSetting = await user_settings.findOne({
            where: { user_uuid: toUser },
          });
          if (userSetting && userSetting.device_reg_token) {
            notificationResponse = await sendCloudNotification({
              title: "New chat message",
              body: message,
              data: {
                ...req.body,
                actionType: "TEXT_CHAT",
              },
              regTokens: [userSetting.device_reg_token],
            }).catch((err) => {
              console.log("err: ", err);
            });
          }
        }

        const devices = await pushnotification.findAll({
          where: { user_uuid: toUser },
        });

        devices.forEach(async (device) => {
          sendWebPushNotificaion({
            webpush_obj: device.notification_object,
            title: "New chat message",
            body: message,
            options: {
              TTL: "3600000",
            },
            isObject: true,
          });
        });

        res.json({ ...data, notificationResponse });
      }
    } catch (error) {
      console.log("error: ", error);
      res.json({
        status: false,
        message: error,
      });
    }
  };

  /**
   * return all the messages associated with toUser, fromUser and a patient
   * @param {*} req
   * @param {*} res
   */
  this.getMessages = async (req, res) => {
    const { fromUser, toUser, patientId } = req.params;
    const keysAndTypeToCheck = [
      { key: "fromUser", type: "string" },
      { key: "toUser", type: "string" },
      { key: "patientId", type: "string" },
    ];
    try {
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getMessages(fromUser, toUser, patientId);
        res.json(data);
      }
    } catch (error) {
      res.json({
        status: false,
        message: error,
      });
    }
  };

  return this;
})();
