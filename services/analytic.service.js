const { analytics } = require("../models");

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
  return this;
})();
