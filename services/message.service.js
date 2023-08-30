const { messages, Sequelize } = require("../models");
const querystring = require("querystring");
const axios = require("axios");
const { log } = require("../handlers/helper");

const axiosKaleyra = axios.create({
  baseURL: "https://api.in.kaleyra.io",
  timeout: 50000,
  headers: { "content-type": "application/x-www-form-urlencoded" },
});

module.exports = (function () {
  /**
   * Create a message entry
   * @param {string} fromUser
   * @param {string} toUser
   * @param {string} message
   */
  this.sendMessage = async (
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
  ) => {
    try {
      let msg = {
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
      };

      if (type) msg.type = type;

      return {
        success: true,
        data: await messages.create(msg),
      };
    } catch (error) {
      console.log("error: sendMessage ", error);
      return {
        success: false,
        data: error,
      };
    }
  };

  /**
   * Return all the chats between 2 users with visits
   * @param {string} fromUserUuid
   * @param {string} toUserUuid
   * @returns []Array
   */
  this.getMessages = async (fromUser, toUser, patientId, visitId) => {
    try {
      if (!visitId) {
        const latestVisit = await messages.findAll({
          where: {
            fromUser: { [Sequelize.Op.in]: [fromUser, toUser] },
            toUser: { [Sequelize.Op.in]: [toUser, fromUser] },
            patientId,
          },
          attributes: [
            [
              Sequelize.fn("DISTINCT", Sequelize.col("patientName")),
              "patientName",
            ],
            "patientPic",
            "message",
            "isRead",
            "fromUser",
            "toUser",
            "visitId",
            "hwName",
            "createdAt",
          ],
          order: [["createdAt", "DESC"]],
        });
        if (latestVisit.length) {
          visitId = latestVisit[0].visitId;
        }
      }

      let data = await messages.findAll({
        where: {
          fromUser: { [Sequelize.Op.in]: [fromUser, toUser] },
          toUser: { [Sequelize.Op.in]: [toUser, fromUser] },
          patientId,
          visitId,
        },
        raw: true,
      });
      for (let i = 0; i < data.length; i++) {
        try {
          data[i].createdAt = new Date(data[i].createdAt).toGMTString();
          data[i].isRead = Boolean(data[i].isRead);
          data[i].isDelivered = Boolean(Number(data[i].isDelivered));
        } catch (error) {}
      }
      return { success: true, data };
    } catch (error) {
      console.log("error: getMessages ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  /**
   * Return all the chats between 2 users without patient id
   * @param {string} fromUserUuid
   * @param {string} toUserUuid
   * @returns []Array
   */
  this.getAllMessages = async (fromUser, toUser) => {
    try {
      const data = await messages.findAll({
        where: {
          fromUser: { [Sequelize.Op.in]: [fromUser, toUser] },
          toUser: { [Sequelize.Op.in]: [toUser, fromUser] },
        },
      });
      for (let i = 0; i < data.length; i++) {
        try {
          data[i].dataValues.createdAt = new Date(
            data[i].dataValues.createdAt
          ).toGMTString();
        } catch (error) {}
      }
      return { success: true, data };
    } catch (error) {
      console.log("error: getAllMessages ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  /**
   * Return all the chats for patients
   * @returns []Array
   */
  this.getPatientMessageList = async (drUuid) => {
    try {
      let data = await messages.findAll({
        attributes: [
          [
            Sequelize.fn("DISTINCT", Sequelize.col("patientName")),
            "patientName",
          ],

          [Sequelize.fn("max", Sequelize.col("message")), "message"],
          [Sequelize.fn("max", Sequelize.col("id")), "id"],
          "patientId",
          "patientPic",
          "isRead",
          "fromUser",
          "toUser",
          "visitId",
          "hwName",
          "createdAt",
        ],
        group: ["patientName"],
        where: {
          patientName: {
            [Sequelize.Op.ne]: null,
          },
          [Sequelize.Op.or]: {
            fromUser: { [Sequelize.Op.in]: [drUuid] },
            toUser: { [Sequelize.Op.in]: [drUuid] },
          },
        },
        raw: true,
      });

      await asyncForEach(data, async (msg, idx) => {
        data[idx].count = await messages.count({
          where: {
            isRead: false,
            patientId: msg.patientId,
          },
        });
      });
      return { success: true, data };
    } catch (error) {
      console.log("error: getPatientMessageList ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  /**
   * Return no of updated documents
   * @param {string} messageId
   * @returns []Array
   */
  this.deliveredById = async (messageId) => {
    try {
      const getMessage = await messages.findAll({
        where: {
          id: messageId,
        },
      });

      setTimeout(() => {
        try {
          const toUser = getMessage[0].toUser;
          const fromUser = getMessage[0].fromUser;
          for (const key in users) {
            if (Object.hasOwnProperty.call(users, key)) {
              const user = users[key];
              if (user && [fromUser, toUser].includes(user.uuid)) {
                io.to(key).emit("msg_delivered", getMessage);
              }
            }
          }
        } catch (error) {
          console.log("error:isread socket ", error);
        }
      }, 1000);

      if (getMessage) {
        const data = await messages.update(
          { isDelivered: true },
          {
            where: {
              [Sequelize.Op.or]: {
                fromUser: {
                  [Sequelize.Op.in]: [
                    getMessage[0].fromUser,
                    getMessage[0].toUser,
                  ],
                },
                toUser: {
                  [Sequelize.Op.in]: [
                    getMessage[0].toUser,
                    getMessage[0].fromUser,
                  ],
                },
              },
              patientId: [getMessage[0].patientId],
            },
          }
        );

        return { success: true, data };
      }

      return { success: false, data: [] };
    } catch (error) {
      console.log("error: readMessagesById ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  /**
   * Return all the visits for patients
   * @returns []Array
   */
  this.getVisits = async (patientId) => {
    try {
      const data = await messages.findAll({
        attributes: ["visitId", "createdAt"],
        where: { patientId },
        order: [["createdAt", "DESC"]],
        group: ["visitId"],
      });
      return { success: true, data };
    } catch (error) {
      console.log("error: getVisits ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  /**
   * Send message to patients on their mobile number
   * @param {string} mobNo
   * @param {string} message
   */
  this.postSMSToMobileNumber = async (mobNo, message) => {
    try {
      // log('message',message);
      const axiosOptions = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "api-key": "A7b6e3f43afd56b241d4aaf9fcb73d742",
        },
      };

      const payload = querystring.stringify({
        to: mobNo,
        sender: "AFIEAP",
        type: "TXN",
        source: "API",
        template_id: "1107165751285758329",
        body: message,
      });

      await axiosKaleyra
        .post("/v1/HXIN1739030324IN/messages", payload, axiosOptions)
        .catch(function (error) {
          log(error);
        });
    } catch (error) {
      log("error: ", error);
    }
  };

  return this;
})();
