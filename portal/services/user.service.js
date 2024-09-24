const { user_status, active_session } = require("../models");

const moment = require("moment");

module.exports = (function () {
  this.TIME_FORMAT = "[H]h [M]m";
  const HEARTBEAT_DURATION = 20;

  const createSession = async (data, duration) => {
    if (duration && duration <= HEARTBEAT_DURATION) {
      active_session.create({
        startTime: moment().subtract(duration, "m").toDate(),
        endTime: new Date(),
        device: data.device,
        userUuid: data.userUuid,
        userType: data.userType ? data.userType : "Health Worker",
        duration,
      });
    }
  };

  this._createUpdateStatus = async (data) => {
    try {
      const { userUuid = "", device = "", forceUpdate = false } = data;
      let status = await user_status.findOne({
        where: {
          userUuid,
        },
        order: [["updatedAt", "ASC"]],
        raw: true,
      });

      const updatedAt = (status && status.updatedAt) || new Date();
      const duration = Math.abs(moment().diff(moment(updatedAt), "m"));

      data.lastSyncTimestamp = new Date();
      if (status) {
        if (duration > 0 && duration <= HEARTBEAT_DURATION) {
          if (!status.totalTime) status.totalTime = "0h 0m";
          const totalTime = moment(status.totalTime, this.TIME_FORMAT);
          const total = moment
            .duration({
              minutes: totalTime.get("minutes"),
              hours: totalTime.get("hours"),
            })
            .add(duration, "minutes");
          data.totalTime = this.getHourMins(total.asMinutes());
        }
        await createSession(data, duration);
        return await user_status.update(data, { where: { id: status.id } });
      } else if (!forceUpdate) {
        await createSession(data, duration);
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
        // offset: query.start ? parseInt(query.start) : 0,
        // limit: query.limit ? parseInt(query.limit) : 10,
        raw: true,
      });
    } catch (error) {
      throw error;
    }
  };

  this.getHourMins = (val = 0) => {
    let hr = Math.abs(Math.floor(val / 60));
    let min = Math.abs(val % 60);
    hr = !isNaN(hr) ? hr : 0;
    min = !isNaN(min) ? min : 0;
    return `${hr}h ${min}m`;
  };
  return this;
})();
