const { callMobilab } = require("../handlers/axiosHelper");

const clinicPath = (id) => `/v1/clinics/${encodeURIComponent(id)}`;

/**
 * GET /v1/clinics
 * @param {object} params - limit, offset, search, status, sort_by
 */
async function getClinics(params) {
  return callMobilab({ method: "GET", url: "/v1/clinics", params });
}

/**
 * POST /v1/clinics - optionally creates the owner user too
 * @param {object} payload
 */
async function createClinic(payload) {
  return callMobilab({ method: "POST", url: "/v1/clinics", data: payload });
}

/**
 * POST /v1/clinics/upload-file - multipart upload, returns { s3_key }
 * @param {object} file - multer file (buffer, originalname, mimetype)
 * @param {object} fields - type, content_type
 */
async function uploadClinicFile(file, { type, content_type }) {
  const form = new FormData();
  const blob = new Blob([file.buffer], { type: content_type || file.mimetype });
  form.append("file_obj", blob, file.originalname);
  form.append("type", type);
  if (content_type) form.append("content_type", content_type);

  return callMobilab({ method: "POST", url: "/v1/clinics/upload-file", data: form });
}

/**
 * GET /v1/clinics/{id}
 * @param {number} id
 */
async function getClinic(id) {
  return callMobilab({ method: "GET", url: clinicPath(id) });
}

/**
 * PATCH /v1/clinics/{id} - partial update, also activate / deactivate
 * @param {number} id
 * @param {object} payload
 */
async function updateClinic(id, payload) {
  return callMobilab({ method: "PATCH", url: clinicPath(id), data: payload });
}

module.exports = {
  getClinics,
  createClinic,
  uploadClinicFile,
  getClinic,
  updateClinic
};
