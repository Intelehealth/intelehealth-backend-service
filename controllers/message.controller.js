const { sendMessage, getMessages } = require("../services/message.service");
const { validateParams } = require("../handlers/helper");

module.exports = (function () {
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
            }
          }
        }
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

  return this;
})();
