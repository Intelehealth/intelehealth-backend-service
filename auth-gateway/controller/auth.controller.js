const { getToken } = require("../handlers/checkAuth");
const { axiosInstance } = require("../handlers/helper");
const buffer = require("buffer").Buffer;

module.exports = (function () {
  /**
   * Login API
   * @param {*} req
   * @param {*} res
   */
  this.login = async (req, res, next) => {
    try {
      console.log(req.body)
      const username = req.body.username;
      const password = req.body.password;
      const rememberme = req.body.rememberme;
      const base64 = buffer.from(`${username}:${password}`).toString("base64");

      const data = await axiosInstance.get("/openmrs/ws/rest/v1/session", {
        headers: {
          Authorization: `Basic ${base64}`,
        },
      });

      
      
      let resp = {
        // data: data?.data,
        status: false,
      };

    
      if (data?.data?.authenticated) {
        resp.token = getToken(
          {
            sessionId: data?.data?.sessionId,
            userId: data?.data?.user?.uuid,
            name: data?.data?.user?.display,
          },
          rememberme ? "15 days" : "2 days"
        );
        resp.status = true;
      }

      res.json(resp);
    } catch (error) {
      next(error);
    }
  };

  return this;
})();
