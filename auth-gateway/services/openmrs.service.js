const { axiosInstance } = require("../handlers/helper");
const { logStream } = require("../logger");

module.exports = (function () {
  /**
   * Create a user
   * @param { string } username - Username
   * @param { string } password - Password
   */
  this._createUser = async ({ username, password, personId, roles = [] }) => {
    try {
      logStream("debug", "Openmrs Service", "Create User");
      return axiosInstance.post(`/openmrs/ws/rest/v1/user`, {
        username,
        password,
        person: personId,
        roles,
      });
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
   * Create a person
   * @param { string } givenName - Person's name
   * @param { string } familyName - family name
   * @param { string } gender - Gender
   * @param { string } birthdate - Date of birth
   * @param { array } addresses - Array of addresses, key will be address1, cityVillage country, postalCode
   */
  this._createPerson = async ({
    givenName,
    familyName,
    gender,
    birthdate,
    addresses = [],
  }) => {
    try {
      logStream("debug", "Openmrs Service", "Create Person");
      return (
        await axiosInstance.post(`/openmrs/ws/rest/v1/person`, {
          names: [
            {
              givenName,
              familyName,
            },
          ],
          gender,
          birthdate,
          addresses,
        })
      ).data;
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
   * Create a provider
   * @param { string } personId - Provider's Id
   * @param { string } identifier - identifier
   * @param { array } attributes - Array of attributes, keys - attributeType, value
   */
  this._createProvider = async ({ personId, identifier, attributes = [] }) => {
    try {
      logStream("debug", "Openmrs Service", "Create Provider");
      return axiosInstance.post(`/openmrs/ws/rest/v1/provider`, {
        person: personId,
        identifier,
        attributes,
        retired: false,
      });
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  this._getUsers = async () => {
    try {
      logStream("debug", "Openmrs Service", "Get Users");
      let response = await axiosInstance.get(`/openmrs/ws/rest/v1/user?q=&v=default`)
      return (response.data);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  this._deleteUser = async (userId) => {
    try {
      logStream("debug", "Openmrs Service", "Delete User");
      let response = await axiosInstance.delete(`/openmrs/ws/rest/v1/user/${userId}?purge=true`)
      return (response.data);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  return this;
})();
