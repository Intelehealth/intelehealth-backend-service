const { RES } = require("../handlers/helper");
const { createCompletion } = require("../services/openai.service");

module.exports = (function () {
    /**
     * Request otp for forgot-username or forgot-password and sing in verification
     * @param {*} req
     * @param {*} res
     */
    this.createCompletion = async (req, res) => {
      try {
        const { payload } = req.body;
        if (payload) {
          const data = await createCompletion(payload);
          RES(
            res,
            {
              success: data.success,
              message: data.message,
              data: data.data,
            },
            data.code
          );
        } else {
          RES(
            res,
            {
              success: false,
              message: "Bad request! Invalid arguments.",
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };
  
    return this;
  })();