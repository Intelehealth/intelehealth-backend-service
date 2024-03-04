const {
  sendMessage,
  getMessages,
  getAllMessages,
  getPatientMessageList,
  readMessagesById,
  getVisits,
} = require("../services/message.service");
const {
  validateParams,
  sendWebPushNotification,
  sendCloudNotification,
  generateUUID
} = require("../handlers/helper");
const { user_settings, pushnotification } = require("../models");
const { uploadFile } = require("../handlers/file.handler");
const Constant = require("../constants/constant");
const { MESSAGE } = require("../constants/messages");
const { logStream } = require("../logger/index");

const sendMobileNotification = (body, userData) => {
  try {
    sendCloudNotification({
      regTokens: [userData?.device_reg_token],
      notification: {
        title: "Chat",
        body: body.message,
        regTokens: [userData?.device_reg_token],
        opts: {
          timeToLive: 60,
        } 
      },
      data: {
        id: generateUUID(),
        nurseId: body.toUser,
        body: body.message,
        type: "chat_message",
        timestamp: Date.now().toString(),
        device_token: userData?.device_reg_token || "",
      },
    });
  } catch (e) {
    logStream('error', e, 'send cloud notification chat')
  }
}

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
            process.env.NODE_ENV === "prod" ? "/intelehealth" : ""
          }/#/dashboard/open-chat/${payload.visitId}`,
        },
        title: `New Chat from ${payload.hwName || "HW"}(${
          payload.patientName || "Patient"
        }):${payload.openMrsId || ""}`,
        body: payload.message,
        options: {
          TTL: "3600000",
        },
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
      openMrsId,
      appType = ''
    } = req.body;
    const keysAndTypeToCheck = [
      { key: Constant.FROM_USER, type: "string" },
      { key: Constant.TO_USER, type: "string" },
      { key: Constant.PATIENT_ID, type: "string" },
      { key: Constant.MESSAGE, type: "string" },
    ];
    let isLiveMessageSent = false,
      messages = [];
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
          type,
          openMrsId,
        );
        
        try {
          messages = await getMessages(fromUser, toUser, patientId, visitId);
        } catch (error) {}
        for (const key in users) {
          if (Object.hasOwnProperty.call(users, key)) {
            const user = users[key];
            let messageData = {};
            if (user && user.uuid == toUser) {
              try {
                data.data.dataValues.createdAt = new Date(
                  data.data.dataValues.createdAt
                ).toGMTString();
                messageData = data.data.toJSON();
                data.data.dataValues.allMessages = messages.data;
              } catch (error) {}
              io.to(key).emit("updateMessage", messageData);
              isLiveMessageSent = true;
            }
          }
        }
        let notificationResponse = "";

        // Send push notification
        const us = await user_settings.findOne({
          where: {
            user_uuid: toUser,
          },
        });
        if (us && us?.notification && appType !== 'webapp') {
          if (us?.snooze_till ? new Date().valueOf() > us?.snooze_till : true) {
            notificationResponse = this.sendMessageNotification(req.body);
          }
        }
        if(us && appType === 'webapp' && !isLiveMessageSent) {
          console.log("USER",JSON.stringify(us, null, 4), fromUser, toUser)
          sendMobileNotification(req.body, us)
        }
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
      { key: Constant.FROM_USER, type: "string" },
      { key: Constant.TO_USER, type: "string" },
      { key: Constant.PATIENT_ID, type: "string" },
    ];
    try {
      logStream('debug', 'API call', 'Get Messages');
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getMessages(fromUser, toUser, patientId, visitId);
        logStream('debug', 'Success', 'Get Messages');
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
      { key: Constant.FROM_USER, type: "string" },
      { key: Constant.TO_USER, type: "string" },
    ];
    try {
      logStream('debug', 'API call', 'Get All Messages');
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
    const keysAndTypeToCheck = [{ key: Constant.MESSAGE_ID, type: "string" }];
    try {
      logStream('debug', 'API call', 'Read Messages By Id');
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
    const keysAndTypeToCheck = [{ key: Constant.PATIENT_ID, type: "string" }];
    try {
      logStream('debug', 'API call', 'Get Visits');
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

  /**
   * Upload file to s3
   */
  this.upload = async (req, res) => {
    try {
      logStream('debug', 'API call', 'Upload File');
      if (!req.files.length) {
        throw new Error(MESSAGE.COMMON.FILE_MUST_BE_PASSED);
      }
      const file = req.files[0];
      const data = await uploadFile(file, "zeetest");
      logStream('debug', 'Success', 'Upload File');
      res.json({
        data,
        success: true,
      });
    } catch (error) {
      logStream("error", error.message);
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  return this;
})();
