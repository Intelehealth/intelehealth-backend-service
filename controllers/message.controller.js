const {
  sendMessage,
  getMessages,
  getAllMessages,
  getPatientMessageList,
  readMessagesById,
} = require("../services/message.service");
const { validateParams } = require("../handlers/helper");
const { user_settings } = require("../models");

module.exports = (function () {
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
    } = req.body;
    const keysAndTypeToCheck = [
      { key: "fromUser", type: "string" },
      { key: "toUser", type: "string" },
      { key: "patientId", type: "string" },
      { key: "message", type: "string" },
    ];
    let isLiveMessageSent = false;
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
          hwPic
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
                ...data.data.dataValues,
                actionType: "TEXT_CHAT",
              },
              regTokens: [userSetting.device_reg_token],
            }).catch((err) => {
              console.log("err: ", err);
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
      const data = await getPatientMessageList();
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

  return this;
})();
