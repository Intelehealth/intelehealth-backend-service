const moment = require("moment");
const { axiosInstance } = require("../handlers/helper");
const { logStream } = require("../logger/index");
const {
  _createPerson,
  _createUser,
  _createProvider,
  _getUser,
} = require("../services/openmrs.service");
const buffer = require("buffer").Buffer;

module.exports = (function () {
  /**
   * Login API
   * @param {*} req
   * @param {*} res
   */
  this.login = async (req, res, next) => {
    try {
      logStream("debug", "API calling", "Login");
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
            .endOf("day")
            .unix()
        );
        resp.status = true;
      }
      logStream("debug", `Login Success for ${username}`, "Login");
      res.json(resp);
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  /**
   * Create user API
   * @param {*} req
   * @param {*} res
   * @param {*} next
   */
  this.createUser = async (req, res, next) => {
    try {
      logStream("debug", "API calling", "Create User");
      const {
        username,
        password,
        givenName,
        familyName,
        gender,
        birthdate,
        addresses,
        role,
        identifier,
        email,
      } = req.body;

      const personPayload = {
        givenName,
        familyName,
        gender,
        birthdate,
        addresses,
      };

      let roles;

      switch (role) {
        case "nurse":
          roles = JSON.parse(process.env.NURSE_ROLES);
          break;
        case "doctor":
          roles = JSON.parse(process.env.DOCTOR_ROLES);
          break;

        default:
          throw new Error("role not found");
      }

      const person = await _createPerson(personPayload);
      logStream("debug", "Person created successfully", "Create User");

      const userPayload = {
        username,
        password,
        personId: person.uuid,
        roles,
      };

      await _createUser(userPayload);
      logStream("debug", "User created successfully", "Create User");

      const providerPayload = {
        personId: person.uuid,
        identifier,
        attributes: [
          {
            attributeType: process.env.EMAIL_PROVIDER_ATTRIBUTE_TYPE,
            value: email,
          },
        ],
        retired: false,
      };

      await _createProvider(providerPayload);

      res.json({
        status: true,
        message: "User created successfully",
      });
    } catch (error) {
      const msg = error?.response?.data?.error?.message;
      next(msg ? new Error(msg) : error);
    }
  };

  /**
   * Validate user if exist with username
   * @param {*} req
   * @param {*} res
   * @param {*} next
   */
  this.validateUser = async (req, res, next) => {
    try {
      logStream("debug", "API calling", "Validate User");
      const { username } = req.body;

      const data = (await _getUser({ username })).data;

      res.json({
        userExist: !!data?.results?.length,
      });
    } catch (error) {
      const msg = error?.response?.data?.error?.message;
      next(msg ? new Error(msg) : error);
    }
  };

  return this;
})();
