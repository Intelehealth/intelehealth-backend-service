const { Messages } = require("../models")(function () {
  /**
   * Create a message entry
   * @param {string} fromUser
   * @param {string} toUser
   * @param {string} message
   */
  this.sendMessage = async (fromUser, toUser, message) => {
    try {
      return {
        success: true,
        data: await Messages.create({ fromUser, toUser, message }),
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
  this.getMessages = async (fromUser, toUser) => {
    try {
      const messages = await Messages.findAll({
        where: {
          fromUser,
          toUser,
        },
        raw: true,
      });
      return { success: true, data: messages };
    } catch (error) {
      console.log("error: getMessages ", error);
      return {
        success: false,
        data: error,
      };
    }
  };

  return this;
})();
