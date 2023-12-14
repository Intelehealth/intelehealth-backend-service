const {
  sendMessage,
  getMessages,
  getAllMessages,
  getPatientMessageList,
  readMessagesById,
  getVisits,
} = require("../services/message.service");
const { validateParams, sendWebPushNotification } = require("../handlers/helper");
const { user_settings, pushnotification } = require("../models");
const { uploadFile } = require("../handlers/file.handler");

module.exports = (function () {

  this.sendMessageNotification = async (payload) => {
    const subscriptions = await pushnotification.findAll({
      where: { user_uuid: payload.toUser },
    });
    subscriptions.forEach(async (sub) => {
      sendWebPushNotification({
        webpush_obj: sub.notification_object,
        data: {
          ...payload,
          url: `${
            process.env.NODE_ENV === "prod" ? "/intelehealth" : ""
          }/#/dashboard/visit-summary/${payload.visitId}?openChat=true`,
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
    } = req.body;
    const keysAndTypeToCheck = [
      { key: "fromUser", type: "string" },
      { key: "toUser", type: "string" },
      { key: "patientId", type: "string" },
      { key: "message", type: "string" },
    ];
    let isLiveMessageSent = false,
      messages = [];
    try {
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
        if (us && us?.notification) {
          if (us?.snooze_till ? new Date().valueOf() > us?.snooze_till : true) {
            notificationResponse = this.sendMessageNotification(req.body);
          }
        }

        res.json({ ...data, notificationResponse });
      }
    } catch (error) {
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
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getMessages(fromUser, toUser, patientId, visitId);
        res.json(data);
      }
    } catch (error) {
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
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getAllMessages(fromUser, toUser);
        res.json(data);
      }
    } catch (error) {
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
      const data = await getPatientMessageList(req.query.drUuid);
      res.json(data);
    } catch (error) {
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
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await readMessagesById(messageId);
        res.json(data);
      }
    } catch (error) {
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
      if (validateParams(req.params, keysAndTypeToCheck)) {
        const data = await getVisits(patientId);
        res.json(data);
      }
    } catch (error) {
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
      if (!req.files.length) {
        throw new Error("File must be passed!");
      }
      const file = req.files[0];
      const data = await uploadFile(file, "zeetest");

      res.json({
        data,
        success: true,
      });
    } catch (error) {
      res.json({
        status: false,
        message: error.message,
      });
    }
  };

  return this;
})();
