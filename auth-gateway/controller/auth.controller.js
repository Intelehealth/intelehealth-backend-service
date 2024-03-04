const moment = require("moment");
const { getToken } = require("../handlers/checkAuth");
const { axiosInstance } = require("../handlers/helper");
const { logStream } = require("../logger/index");
const buffer = require("buffer").Buffer;

module.exports = (function () {
  /**
   * Login API
   * @param {*} req
   * @param {*} res
   */
  this.login = async (req, res, next) => {
    try {
      logStream('debug','API calling', 'Login');
      const { username, password, rememberme } = req.body;
      const base64 = buffer.from(`${username}:${password}`).toString("base64");

      const data = await axiosInstance.get("/openmrs/ws/rest/v1/session", {
        headers: {
          Authorization: `Basic ${base64}`,
        },
      });

      const resp = {
        status: false,
      };

      if (data?.data?.authenticated) {
        const expiresIn = rememberme ? 3 : 15;
        resp.token = getToken(
          {
            sessionId: data?.data?.sessionId,
            userId: data?.data?.user?.uuid,
            name: data?.data?.user?.display,
          },
          moment()
          // .add(expiresIn, "days")
          .endOf("day").unix()
        );
        resp.status = true;
      }
      logStream('debug',`Login Success for user ${username}`, 'Login');
      res.json(resp);
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  return this;
})();
