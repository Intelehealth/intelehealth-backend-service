module.exports = (function () {
  this.validateParams = (params, keysAndTypeToCheck = []) => {
    try {
      keysAndTypeToCheck.forEach((obj) => {
        if (!params[obj.key] && typeof params[obj.key] !== obj.type) {
          if (!params[obj.key]) {
            throw `Invalid request, ${obj.key} is missing.`;
            return false;
          }
          if (!params[obj.key]) {
            throw `Wrong param type for ${obj.key}(${typeof params[
              obj.key
            ]}), required type is ${obj.type}.`;
            return false;
          }
        }
      });
      return true;
    } catch (error) {
      throw error;
    }
  };

  return this;
})();
