const {
  sendMessage,
  getMessages,
  postSMSToMobileNumber,
  readMessagesById,
} = require("../services/message.service");
const {
  validateParams,
  log,
  sendCloudNotification,
  // getFirebaseAdmin,
  sendWebPushNotificaion,
} = require("../handlers/helper");
const { user_settings, pushnotification } = require("../models");
// const env = process.env.NODE_ENV || "development";
// const config = require(__dirname + "/../config/config.json")[env];

module.exports = (function () {
  // const admin = getFirebaseAdmin();
  // const db = admin.database();
  // const DB_NAME = `${config.domain.replace(/\./g, "_")}/TEXT_CHAT`;
  // const textChatRef = db.ref(DB_NAME);

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
        console.log("type: ", type);
        try {
          messages = await getMessages(fromUser, toUser, patientId, visitId);
        } catch (error) {}
        for (const key in users) {
          if (Object.hasOwnProperty.call(users, key)) {
            const user = users[key];
            if (user && user.uuid == toUser) {
              try {
                data.data.dataValues.createdAt = new Date(
                  data.data.dataValues.createdAt
                ).toGMTString();
                messageData = data.data.toJSON();
              } catch (error) {}
              io.to(key).emit("updateMessage", messageData);
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
            title: `New Chat from ${hwName || "HW"}(${patientName||'Patient'}) `,
            body: message,
            options: {
              TTL: "3600000",
            },
            isObject: true,
          });
        });

        // await textChatRef.update({
        //   [req.body.visitId]: req.body,
        // });

        // Send push notification
        const us = await user_settings.findOne({
          where: {
            user_uuid: toUser,
          },
        });
        if (us && us?.notification) {
          const subscriptions = await getSubscriptions(us.user_uuid);
          if (subscriptions.length) {
            subscriptions.forEach(async (sub) => {
              await sendNotification(
                JSON.parse(sub.notification_object),
                "Hey! You got new chat message",
                message
              );
            });
          }
        }

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
  // this.upload = async (req, res) => {
  //   try {
  //     if (!req.files.length) {
  //       throw new Error("File must be passed!");
  //     }
  //     const file = req.files[0];
  //     const data = await uploadFile(file, "");

  //     res.json({
  //       data,
  //       success: true,
  //     });
  //   } catch (error) {
  //     res.json({
  //       status: false,
  //       message: error.message,
  //     });
  //   }
  // };

  /**
   * Method for sending sms to patients
   * @param {*} req
   * @param {*} res
   */
  this.sendSMS = async (req, res) => {
    const { message, patients = [] } = req.body;
    try {
      if (patients) {
        for (let idx = 0; idx < patients.length; idx++) {
          const patientMobNo = patients[idx];
          await postSMSToMobileNumber(patientMobNo, message);
        }
        return res.json({
          status: true,
          message: "SMS sent successfully.",
        });
      }
    } catch (error) {
      log("error: ", error);
      res.json({
        status: false,
        message: error,
      });
    }
  };

  return this;
})();
