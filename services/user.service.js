const { user_status } = require("../models");

module.exports = (function () {
  this._createUpdateStatus = async (data) => {
    try {
      const { userUuid, device } = data;
      const status = await user_status.findOne({ userUuid, device });
      if (status) {
        return await user_status.update(data, { where: { id: status.id } });
      } else {
        return await user_status.create(data);
      }
    } catch (error) {
      throw error;
    }
  };

  this._getStatuses = async (userUuid, query = {}) => {
    try {
      return await user_status.findAll({
        where: {
          userUuid,
        },
        offset: query.start ? parseInt(query.start) : 0,
        limit: query.limit ? parseInt(query.limit) : 5,
        raw: true,
      });
    } catch (error) {
      throw error;
    }
  };
  return this;
})();
