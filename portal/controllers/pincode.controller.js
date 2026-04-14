const axios = require("axios");
const { logStream } = require("../logger/index");

module.exports = (function () {
  this.getPincode = async (req, res, next) => {
    try {
      const { pincode } = req.params;
      if (!pincode || !/^\d{6}$/.test(pincode)) {
        return res.status(400).json({ status: false, message: "Invalid pincode. Must be a 6-digit number." });
      }
      const response = await axios.get(`http://www.postalpincode.in/api/pincode/${pincode}`);
      return res.json(response.data);
    } catch (error) {
      logStream("error", error.message, "Get Pincode");
      next(error);
    }
  };

  return this;
}).call({});
