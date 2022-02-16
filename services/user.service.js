const { user_status } = require("../models");
const moment = require("moment");

module.exports = (function () {
  this._createUpdateStatus = async (data) => {
    try {
      const { userUuid, device } = data;
      const status = await user_status.findOne({ userUuid, device });
      if (status) {
        if (data.avgTimeSpentOneDay) {
          let time = moment(status.avgTimeSpentOneDay, "h[h] m[m]");
          const timeToUpdate = moment(data.avgTimeSpentOneDay, "h[h] m[m]");
          let hr1 = time.get("hours");
          let hr2 = timeToUpdate.get("hours");

          let min1 = time.get("minutes");
          let min2 = timeToUpdate.get("minutes");
          const min = min1 > 0 ? Math.floor((min1 + min2) / 2) : min2;
          const hr = hr1 > 0 ? Math.floor((hr1 + hr2) / 2) : hr2;

          data.avgTimeSpentOneDay = `${hr}h ${min}m`;
        }
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
      let where = {};
      if (userUuid) {
        where = {
          userUuid,
        };
      }
      return await user_status.findAll({
        where,
        offset: query.start ? parseInt(query.start) : 0,
        limit: query.limit ? parseInt(query.limit) : 10,
        raw: true,
      });
    } catch (error) {
      throw error;
    }
  };
  return this;
})();
