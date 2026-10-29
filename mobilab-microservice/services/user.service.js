const { callMobilab } = require("../handlers/axiosHelper");

const userPath = (id) => `/v1/users/${encodeURIComponent(id)}`;

/**
 * GET /v1/roles
 * @param {object} params - limit, offset
 */
async function getRoles(params) {
  return callMobilab({ method: "GET", url: "/v1/roles", params });
}

/**
 * GET /v1/users
 * @param {object} params - limit, offset, search, clinic_id, role_slug, category, sort_by
 */
async function getUsers(params) {
  return callMobilab({ method: "GET", url: "/v1/users", params });
}

/**
 * POST /v1/users - e.g. a phlebotomist who logs in to the app by phone_number
 * @param {object} payload
 */
async function createUser(payload) {
  return callMobilab({ method: "POST", url: "/v1/users", data: payload });
}

/**
 * GET /v1/users/{id}
 * @param {number} id
 */
async function getUser(id) {
  return callMobilab({ method: "GET", url: userPath(id) });
}

/**
 * PATCH /v1/users/{id}
 * @param {number} id
 * @param {object} payload
 */
async function updateUser(id, payload) {
  return callMobilab({ method: "PATCH", url: userPath(id), data: payload });
}

/**
 * DELETE /v1/users/{id} - soft delete, frees email and phone number
 * @param {number} id
 */
async function deleteUser(id) {
  return callMobilab({ method: "DELETE", url: userPath(id) });
}

module.exports = {
  getRoles,
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser
};
