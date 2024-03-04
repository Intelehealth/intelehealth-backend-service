const { sendMessage, getMessages, getPatientMessageList, readMessagesById, getAllMessages, getVisits } = require("../services/message.service");
const {
  validateParams,
  sendWebPushNotification,
} = require("../handlers/helper");
const { logStream } = require("../logger/index");
const { user_settings, pushnotification } = require("../models");

module.exports = (function () {
  this.sendMessageNotification = async (payload) => {
    logStream('debug', 'API call', 'Send Message Notification');
    const subscriptions = await pushnotification.findAll({
      where: { user_uuid: payload.toUser },
    });
    const res = [];
    subscriptions.forEach(async (sub) => {
      sendWebPushNotification({
        webpush_obj: sub.notification_object,
        data: {
          ...payload,
          url: `${
            process.env.NODE_ENV === "production" ? "/intelehealth" : ""
          }/#/visit-summary/${payload.patientId}/${payload.visitId}?openChat=true`,
        },
        title: `New Chat from ${payload.hwName || "HW"}(${
          payload.patientName || "Patient"
        }):${payload.openMrsId || ""}`,
        body: payload.message,
        options: {
          TTL: "3600000",
        }
      });
    });
    logStream('debug', 'Success', 'Send Message Notification');
  };
  /**
   * Method to create message entry and transmit it to socket on realtime
   * @param {*} req
   * @param {*} res
   */
  this.sendMessage = async (req, res) => {
    const {
      fromUser,
      toUser,
      patientId,
      message,
      isRead,
      patientPic,
      visitId,
      patientName,
      hwName,
      hwPic,
      type,
    } = req.body
    const keysAndTypeToCheck = [
      { key: "fromUser", type: "string" },
      { key: "toUser", type: "string" },
      { key: "patientId", type: "string" },
      { key: "message", type: "string" },
    ];
    let isLiveMessageSent = false;
    try {
      logStream('debug', 'API call', 'Send Message');
      if (validateParams(req.body, keysAndTypeToCheck)) {
        const data = await sendMessage(
          fromUser,
          toUser,
          patientId,
          message,
          isRead,
          patientPic,
          visitId,
          patientName,
          hwName,
          hwPic,
          type
        );
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

        this.sendMessageNotification(req.body);
        logStream('debug', 'Success', 'Send Message');
        res.json({ ...data, notificationResponse });
      }
    } catch (error) {
      logStream("error", error.message);
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
    const visitId = req.query.visitId;
    const keysAndTypeToCheck = [
      { key: "fromUser", type: "string" },
      { key: "toUser", type: "string" },
      { key: "patientId", type: "string" },
    ];
    try {
      logStream('debug', 'API call', 'Get Message')
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getMessages(fromUser, toUser, patientId, visitId);
        logStream('debug', 'Success', 'Get Message');
        res.json(data);
      }
    } catch (error) {
      logStream("error", error.message);
      res.json({
        status: false,
        message: error,
      });
    }
  };

  /**
   * return all the messages associated with toUser, fromUser
   * @param {*} req
   * @param {*} res
   */
  this.getAllMessages = async (req, res) => {
    const { fromUser, toUser } = req.params;
    const keysAndTypeToCheck = [
      { key: "fromUser", type: "string" },
      { key: "toUser", type: "string" },
    ];
    try {
      logStream('debug', 'API call', 'Get All Messages')
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getAllMessages(fromUser, toUser);
        logStream('debug', 'Success', 'Get All Messages');
        res.json(data);
      }
    } catch (error) {
      logStream("error", error.message);
      res.json({
        status: false,
        message: error,
      });
    }
  };

  /**
   * return all the patients messages
   * @param {*} req
   * @param {*} res
   */
  this.getPatientMessageList = async (req, res) => {
    try {
      logStream('debug', 'API call', 'Get Patient Message List');
      const data = await getPatientMessageList(req.query.drUuid);
      logStream('debug', 'Success', 'Get Patient Message List');
      res.json(data);
    } catch (error) {
      logStream("error", error.message);
      res.json({
        status: false,
        message: error,
      });
    }
  };

  /**
   * return message associated with toUser, fromUser and a patient
   * @param {*} req
   * @param {*} res
   */
  this.readMessagesById = async (req, res) => {
    const { messageId } = req.params;
    const keysAndTypeToCheck = [{ key: "messageId", type: "string" }];
    try {
      logStream('debug', 'API call', 'Read Messages By Id')
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await readMessagesById(messageId);
        logStream('debug', 'Success', 'Read Messages By Id');
        res.json(data);
      }
    } catch (error) {
      logStream("error", error.message);
      res.json({
        status: false,
        message: error,
      });
    }
  };

  /**
   * return all the visits associated with patient
   * @param {*} req
   * @param {*} res
   */
  this.getVisits = async (req, res) => {
    const { patientId } = req.params;
    const keysAndTypeToCheck = [{ key: "patientId", type: "string" }];
    try {
      logStream('debug', 'API call', 'Get Visits')
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getVisits(patientId);
        logStream('debug', 'Success', 'Get Visits');
        res.json(data);
      }
    } catch (error) {
      logStream("error", error.message);
      res.json({
        status: false,
        message: error,
      });
    }
  };

  return this;
})();
