const {
  sendMessage,
  getMessages,
  postSMSToMobileNumber,
} = require("../services/message.service");
const { validateParams, log, getFirebaseAdmin } = require("../handlers/helper");
const { user_settings } = require("../models");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];

module.exports = (function () {
  const admin = getFirebaseAdmin();
  const db = admin.database();
  const DB_NAME = `${config.domain.replace(/\./g, "_")}/TEXT_CHAT`;
  console.log("DB_NAME: ", DB_NAME);
  const textChatRef = db.ref(DB_NAME);
  textChatRef.update({
    test: 1,
  });
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
              log("err: ", err);
            });
          }
        }

        try {
          await textChatRef.update({
            [req.body.visitId]: req.body,
          });
        } catch (error) {
          console.log("error: ", error);
        }

        res.json({ ...data, notificationResponse });
      }
    } catch (error) {
      log("error: ", error);
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
