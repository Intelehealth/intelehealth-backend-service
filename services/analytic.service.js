const { analytics, active_session } = require("../models");
const moment = require("moment");

module.exports = (function () {
  this._trackActions = async (data) => {
    try {
      return await analytics.create(data);
    } catch (error) {
      throw error;
    }
  };

  this._getActions = async (userUuid, query = {}) => {
    try {
      return await analytics.findAll({
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

  this.connect = async ({ uuid: userUuid, device, userType }) => {
    try {
      if (userUuid) {
        await active_session.create({
          startTime: new Date(),
          device,
          userUuid,
          userType,
        });
      }
    } catch (error) {
      console.log("error: ", error);
    }
  };

  this.disconnect = async ({ uuid: userUuid, userType }) => {
    try {
      let session = await active_session.findOne({
        where: {
          userUuid,
          duration: null,
        },
      });
      if (session) {
        const sessionVal = session.get();
        session.endTime = new Date();
        const minutes = Math.abs(moment(sessionVal.startTime).diff(moment(), "minutes"));
        console.log('minutes: >>>>>>>>>>>>>>>>>', minutes);
        session.duration = minutes;
        if (minutes > 0) {
          if (userType) session.userType = userType;
          await session.save();
        } else {
          session.destroy();
        }
      }
    } catch (error) {
      console.log("error: ", error);
    }
    console.log("disconnect:userUuid: ", userUuid);
  };
  return this;
})();
