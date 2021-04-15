const { messages, Sequelize } = require("../models");

module.exports = (function () {
  /**
   * Create a message entry
   * @param {string} fromUser
   * @param {string} toUser
   * @param {string} message
   */
  this.sendMessage = async (fromUser, toUser, patientId, message) => {
    try {
      return {
        success: true,
        data: await messages.create({ fromUser, toUser, patientId, message }),
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
   * Return all the chats between 2 users
   * @param {string} fromUserUuid
   * @param {string} toUserUuid
   * @returns []Array
   */
  this.getMessages = async (fromUser, toUser, patientId) => {
    try {
      const data = await messages.findAll({
        where: {
          fromUser: { [Sequelize.Op.in]: [fromUser, toUser] },
          toUser: { [Sequelize.Op.in]: [toUser, fromUser] },
          patientId,
        },
      });
      return { success: true, data };
    } catch (error) {
      console.log("error: getMessages ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  return this;
})();
