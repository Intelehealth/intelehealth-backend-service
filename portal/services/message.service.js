const { asyncForEach } = require("../handlers/helper");
const { messages, Sequelize } = require("../models");

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
    type,
    openMrsId
  ) => {
    try {
      const msg = {
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
        openMrsId
      };

      if (type) msg.type = type;

      return {
        success: true,
        data: await messages.create(msg),
      };
    } catch (error) {
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
            "openMrsId"
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
            Sequelize.fn("DISTINCT", Sequelize.col("patientId")),
            "patientId",
          ],
          [Sequelize.fn("max", Sequelize.col("id")), "id"],
          [Sequelize.fn("min", Sequelize.col("id")), "firstId"]
        ],
        group: ["patientId"],
        order: [[Sequelize.col("id"), "DESC"]],
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

        const record = await messages.findOne({
          attributes: [
            "message",
            "patientName",
            "patientPic",
            "hwName",
            "visitId",
            "fromUser",
            "toUser",
            "openMrsId"
          ],
          where: {
            id: msg.firstId
          }
        });
        data[idx].message = record.message;
        data[idx].patientName = record.patientName;
        data[idx].patientPic = record.patientPic;
        data[idx].hwName = record.hwName;
        data[idx].visitId = record.visitId;
        data[idx].fromUser = record.fromUser;
        data[idx].toUser = record.toUser;
        data[idx].openMrsId = record.openMrsId;
      });
      return { success: true, data };
    } catch (error) {
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
  this.readMessagesById = async (messageId) => {
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
                io.to(key).emit("isread", getMessage);
              }
            }
          }
        } catch (error) {
        }
      }, 1000);

      if (getMessage) {
        const data = await messages.update(
          { isRead: true, isDelivered: true },
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
        attributes: [
          [
            Sequelize.fn("max", Sequelize.col("createdAt")),
            "createdAt",
          ],
          "visitId"
        ],
        where: { patientId },
        group: ["visitId"],
        order: [[Sequelize.col("createdAt"), "DESC"]],
      });
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        data: [],
        error
      };
    }
  };

  return this;
})();
