const moment = require("moment");
const { axiosInstance } = require("../handlers/helper");
const { logStream } = require("../logger/index");
const {
  _createPerson,
  _createUser,
  _createProvider,
  _getUsers,
  _deleteUser,
  _deletePerson,
  _updateUser,
  _getUserByUuid,
  _getUser,
  _resetPasswordByUuid,
  _getProvider,
  _setProvider
} = require("../services/openmrs.service");
const { logged_in_users, black_list_tokens } = require("../models");
const { createError } = require("../handlers/createError");
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
        const token = getToken(
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

        // Store token in the database
        await logged_in_users.create({ userId: data?.data?.user?.uuid, token: token, loggedAt: moment().toISOString() });

        resp.token = token;
        resp.status = true;
      }
      logStream("debug", `Login Success for ${username}`, "Login");
      res.json(resp);
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  this.getUsers = async (req, res, next) => {
    try {
      logStream("debug", "API calling", "Get Users");
      const users = await _getUsers();
      logStream("debug", 'Got the user list', "Get Users");
      res.json({
        data: users.results,
        status: true
      });
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  this.getUser = async (req, res, next) => {
    try {
      const { user_uuid } = req.params;
      logStream("debug", "API calling", "Get User");
      const userData = await _getUserByUuid(user_uuid);
      logStream("debug", 'Got the user', "Get User");
      res.json({
        data: userData,
        status: true
      });
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
      let {
        username,
        password,
        givenName,
        middleName,
        familyName,
        gender,
        birthdate,
        addresses,
        role,
        identifier,
        emailId,
        phoneNumber,
        countryCode
      } = req.body;

      if(!addresses) addresses = [{country:"india"}];
      if(!identifier) identifier = username;
      if(!middleName) middleName = null;

      const personPayload = {
        givenName,
        familyName,
        middleName,
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
        case "mcc":
          roles = JSON.parse(process.env.MCC_ROLES);
          break;

        default:
          throw createError("Role not found", 404);
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
            value: emailId,
          },
          {
            attributeType: process.env.PHONE_NUMBER_PROVIDER_ATTRIBUTE_TYPE,
            value: phoneNumber,
          },
          {
            attributeType: process.env.COUNTRY_CODE_PROVIDER_ATTRIBUTE_TYPE,
            value: countryCode,
          }
        ],
        retired: false,
      };

      await _createProvider(providerPayload);

      res.json({
        status: true,
        message: "User created successfully",
      });
    } catch (error) {
      console.log("Create user error=============>",error.toString());
      next(error);
    }
  };

  this.deleteUser = async (req, res, next) => {
    try {
      const { uuid } = req.params;
      logStream("debug", "API calling", "Delete User");

      const userData = await _getUserByUuid(uuid);
      
      // Fetch all logged-in users related to this user
      const loggedInUsers = await logged_in_users.findAll({ where: { userId: uuid }});
      
      if(loggedInUsers){
        // Prepare an array to insert into the black_list_tokens table
        const blackListTokens = loggedInUsers.map(user => ({
          userId: user.userId,
          token: user.token,
        }));
        
        // Bulk insert into the black_list_tokens table
        if (blackListTokens.length > 0) {
          await black_list_tokens.bulkCreate(blackListTokens);
          logStream("debug", "Inserted multiple records into black_list_tokens", "Delete User");
        }
      }

      await _deletePerson(userData.person.uuid);
      logStream("debug", 'Deleted the person', "Delete User");

      await _deleteUser(uuid);
      logStream("debug", 'Deleted the user', "Delete User");
      res.json({
        message: "User deleted successfully",
        status: true
      });
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  this.updateUser = async (req, res, next) => {
    try {
      logStream("debug", "API calling", "Update User");
      const { uuid } = req.params;
      const {
        username,
        password,
        givenName,
        familyName,
        gender,
        birthdate,
        addresses,
        role
      } = req.body;

      let roles;
      switch (role) {
        case "nurse":
          roles = JSON.parse(process.env.NURSE_ROLES);
          break;
        case "doctor":
          roles = JSON.parse(process.env.DOCTOR_ROLES);
          break;

        default:
          throw createError("Role not found", 404);
      }

      const userPayload = {
        username,
        password,
        roles
      };
      await _updateUser(uuid, userPayload);
      logStream("debug", 'Updated the user', 'Update User');


      const userData = await _getUserByUuid(uuid);
      logStream("debug", 'Get the person', 'Update User');

      const personPayload = {
        givenName,
        familyName,
        gender,
        birthdate,
        addresses,
      };
      await _updatePerson(userData.person.uuid, personPayload);
      logStream("debug", 'Updated the Person', 'Update Person');

      res.json({
        message: "User updated successfully",
        status: true
      })
    } catch (error) {
      logStream("error", error.message);
      next(error);
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
      next(error);
    }
  };

  /**
   * Reset user password by uuid
   * @param {*} req
   * @param {*} res
   * @param {*} next
   */
  this.resetPassword = async (req, res, next) => {
    try {
      logStream("debug", "API calling", "User Reset Password By UUID");
      const { newPassword } = req.body;
      const { uuid } = req.params

      const payload = {
        "newPassword" : newPassword
      };

      await _resetPasswordByUuid(uuid, payload)
      
      logStream("debug", 'Updated Password', 'User Reset Password By UUID');
      res.json({
        message: "User password updated successfully",
        status: true
      });
    } catch (error) {
      next(error);
    }
  };

  this.getProvider = async (req, res, next) => {
    try {
      const { user_uuid } = req.params;
      logStream("debug", "API calling", "Get Provider");
      const provider = await _getProvider(user_uuid);
      logStream("debug", 'Got the Provider', "Get Provider");
      res.json({
        results: provider.results,
        status: true
      });
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  this.setProvider = async (req, res, next) => {
    try {
      const { uuid } = req.params;
      const data = req.body;
      logStream("debug", "API calling", "Set Provider");
      await _setProvider(uuid, data);
      logStream("debug", 'Set the Provider', "Set Provider");
      res.json({
        data: "User updated successfully",
        status: true
      });
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };
  return this;
})();
