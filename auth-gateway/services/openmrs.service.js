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
    middleName,
    birthdate,
    addresses = []
  }) => {
    try {
      logStream("debug", "Openmrs Service", "Create Person");
      return (
        await axiosInstance.post(`/openmrs/ws/rest/v1/person`, {
          names: [
            {
              givenName,
              familyName,
              middleName
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

  /**
 * Create a provider
 * @param { string } personId - Provider's Id
 * @param { string } identifier - identifier
 * @param { array } attributes - Array of attributes, keys - attributeType, value
 */
  this._getUser = async ({ username }) => {
    try {
      logStream("debug", "Openmrs Service", "Get User");
      return axiosInstance.get(
        `/openmrs/ws/rest/v1/user?q=${username}&v=default`
      );
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
  * Get users saved in database
  */
  this._getUsers = async () => {
    try {
      logStream("debug", "Openmrs Service", "Get Users");
      let response = await axiosInstance.get(`/openmrs/ws/rest/v1/user?q=&v=custom:(uuid,person:(uuid,display,gender,age,birthdate,preferredName),roles,username,dateCreated)`)
      return (response.data);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
 * Delete user
 * @param { number } userId - user id
 */
  this._deleteUser = async (userId) => {
    try {
      logStream("debug", "Openmrs Service", "Delete User");
      let response = await axiosInstance.delete(`/openmrs/ws/rest/v1/user/${userId}`)
      return (response);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
* Delete person
* @param { number } personId - person id
*/
  this._deletePerson = async (personId) => {
    try {
      logStream("debug", "Openmrs Service", "Delete person");
      let response = await axiosInstance.delete(`/openmrs/ws/rest/v1/person/${personId}`)
      return (response);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
   * Get user saved in database
   * @param { number } uuid - user id
   */
  this._getUserByUuid = async (uuid) => {
    try {
      logStream("debug", "Openmrs Service", "Get Person By User");
      let response = await axiosInstance.get(`/openmrs/ws/rest/v1/user/${uuid}?v=custom:(uuid,person:(uuid,display,gender,age,birthdate,preferredName),roles,username)`)
      return (response.data);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
   * Update user
   * @param { number } uuid - user id
   *  @param { string } username - userName
   *  @param { string } password - password
   *  @param { array } roles - roles
   */
  this._updateUser = async (userId, { username, password, roles }) => {
    try {
      logStream("debug", "Openmrs Service", "Update User");
      let response = await axiosInstance.post(`/openmrs/ws/rest/v1/user/${userId}`,
        { username, password, roles });
      return (response.data);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
  * Update user
  * @param { number } personId - person id
  *  @param { string } givenName - givenName
  *  @param { string } familyName - familyName
  *  @param { string } gender - gender
  *  @param { string } birthdate - birthdate
  *  @param { array } addresses - addresses
  */
  this._updatePerson = async (personId, {
    givenName,
    familyName,
    gender,
    birthdate,
    addresses,
  }) => {
    try {
      logStream("debug", "Openmrs Service", "Update person");
      let response = await axiosInstance.post(`/openmrs/ws/rest/v1/person/${personId}`,
        {
          names: [
            {
              givenName,
              familyName,
            },
          ],
          gender,
          birthdate,
          addresses
        });
      return (response.data);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
  * Reset user password saved in database
  * @param { number } uuid - user id
  * @param { object } body - user id
  */
  this._resetPasswordByUuid = async (uuid, body) => {
    try {
      logStream("debug", "Openmrs Service", "User reset password by UUID ");
      let response = await axiosInstance.post(`/openmrs/ws/rest/v1/password/${uuid}`, body)
      return (response.data);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
  * Get provider saved in database
  */
  this._getProvider = async (user_uuid) => {
    try {
      logStream("debug", "Openmrs Service", "Get Provider");
      let response = await axiosInstance.get(`/openmrs/ws/rest/v1/provider?user=${user_uuid}&v=custom:(uuid,person:(uuid,display,gender,age,birthdate,preferredName),attributes)`);
      return (response.data);
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
  * Get provider saved in database
  */
  this._setProvider = async (uuid, data) => {
    try {
      logStream("debug", "Openmrs Service", "Set Provider");
      let promiseArray = [];
      data.forEach(async ele => {
        let payload = { value : ele.value};
        await axiosInstance.post(`/openmrs/ws/rest/v1/provider/${uuid}/attribute/${ele.uuid}`,payload);
      });
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  return this;
})();
