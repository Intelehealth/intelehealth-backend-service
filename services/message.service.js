const { messages, Sequelize } = require("../models");
const querystring = require("querystring");
const axios = require("axios");

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
      for (let i = 0; i < data.length; i++) {
        try {
          data[i].dataValues.createdAt = new Date(
            data[i].dataValues.createdAt
          ).toGMTString();
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
   * Send message to patients on their mobile number
   * @param {string} mobNo
   * @param {string} message
   */
  this.postSMSToMobileNumber = async (mobNo, message) => {
    try {
      // console.log('message',message);
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
          console.log(error);
        });
    } catch (error) {
      console.log("error: ", error);
    }
  };

  return this;
})();
