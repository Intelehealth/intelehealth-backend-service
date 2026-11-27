const {
  upsertResource,
  upsertAssetResource,
  getResource,
  getChildResources,
  getPendingResources,
  bulkMarkSynced,
  deleteResource,
} = require("../services/temp-storage.service");
const { RES } = require("../handlers/helper");
const { MESSAGE } = require("../constants/messages");
const { logStream } = require("../logger/index");

const VALID_RESOURCE_TYPES = ["patient", "visit", "asset"];

module.exports = (function () {
  /**
   * POST /temp-storage — Upsert a resource (patient, visit, asset, etc.)
   * @param {request} req
   * @param {response} res
   */
  this.upsertResource = async (req, res) => {
    try {
      logStream("debug", "API call", "Upsert Resource");
      const { resource_type, resource_id, created_by } = req.body;

      if (!resource_type || !VALID_RESOURCE_TYPES.includes(resource_type)) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.RESOURCE_TYPE_REQUIRED }, 400);
      }
      if (!resource_id) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.RESOURCE_ID_REQUIRED }, 400);
      }
      if (!created_by) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.CREATED_BY_REQUIRED }, 400);
      }

      const { record, created } = await upsertResource(req.body);
      logStream("debug", "Success", "Upsert Resource");
      RES(
        res,
        {
          success: true,
          message: created
            ? MESSAGE.TEMP_STORAGE.RESOURCE_CREATED_SUCCESSFULLY
            : MESSAGE.TEMP_STORAGE.RESOURCE_UPDATED_SUCCESSFULLY,
          data: record,
        },
        created ? 201 : 200
      );
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, error.code || 500);
    }
  };

  /**
   * POST /temp-storage/upload — Upsert asset resource with file upload (multipart)
   * @param {request} req
   * @param {response} res
   */
  this.upsertAssetResource = async (req, res) => {
    try {
      logStream("debug", "API call", "Upsert Asset Resource");
      const { resource_type, resource_id, created_by } = req.body;

      if (!resource_type || !VALID_RESOURCE_TYPES.includes(resource_type)) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.RESOURCE_TYPE_REQUIRED }, 400);
      }
      if (!resource_id) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.RESOURCE_ID_REQUIRED }, 400);
      }
      if (!created_by) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.CREATED_BY_REQUIRED }, 400);
      }

      const file = req.files && req.files.length > 0 ? req.files[0] : null;
      if (!file) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.FILE_REQUIRED }, 400);
      }

      // Parse data field if it's a string (from multipart form)
      if (typeof req.body.data === "string") {
        try {
          req.body.data = JSON.parse(req.body.data);
        } catch (e) {
          // keep as-is if not valid JSON
        }
      }

      const { record, created } = await upsertAssetResource(req.body, file);
      logStream("debug", "Success", "Upsert Asset Resource");
      RES(
        res,
        {
          success: true,
          message: created
            ? MESSAGE.TEMP_STORAGE.RESOURCE_CREATED_SUCCESSFULLY
            : MESSAGE.TEMP_STORAGE.RESOURCE_UPDATED_SUCCESSFULLY,
          data: record,
        },
        created ? 201 : 200
      );
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, error.code || 500);
    }
  };

  /**
   * GET /temp-storage/:resourceType/:resourceId — Fetch a single resource by type and ID
   * @param {request} req
   * @param {response} res
   */
  this.getResource = async (req, res) => {
    try {
      logStream("debug", "API call", "Get Resource");
      const { resourceType, resourceId } = req.params;

      const record = await getResource(resourceType, resourceId);
      if (!record) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.RESOURCE_NOT_FOUND }, 404);
      }

      logStream("debug", "Success", "Get Resource");
      RES(res, { success: true, message: MESSAGE.TEMP_STORAGE.RESOURCE_FETCHED_SUCCESSFULLY, data: record }, 200);
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, error.code || 500);
    }
  };

  /**
   * GET /temp-storage/:resourceType/:resourceId/children?type= — Fetch child resources
   * @param {request} req
   * @param {response} res
   */
  this.getChildResources = async (req, res) => {
    try {
      logStream("debug", "API call", "Get Child Resources");
      const { resourceType, resourceId } = req.params;
      const { type } = req.query;

      const records = await getChildResources(resourceType, resourceId, type);

      logStream("debug", "Success", "Get Child Resources");
      RES(res, { success: true, message: MESSAGE.TEMP_STORAGE.CHILDREN_FETCHED_SUCCESSFULLY, data: records }, 200);
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, error.code || 500);
    }
  };

  /**
   * GET /temp-storage/pending?resourceType=&createdBy= — Fetch all unsynced records
   * @param {request} req
   * @param {response} res
   */
  this.getPendingResources = async (req, res) => {
    try {
      logStream("debug", "API call", "Get Pending Resources");
      const { resourceType, createdBy } = req.query;

      const records = await getPendingResources({ resourceType, createdBy });

      logStream("debug", "Success", "Get Pending Resources");
      RES(res, { success: true, message: MESSAGE.TEMP_STORAGE.PENDING_FETCHED_SUCCESSFULLY, data: records }, 200);
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, error.code || 500);
    }
  };

  /**
   * PATCH /temp-storage/sync — Bulk mark records as synced
   * @param {request} req
   * @param {response} res
   */
  this.bulkMarkSynced = async (req, res) => {
    try {
      logStream("debug", "API call", "Bulk Mark Synced");
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.IDS_REQUIRED }, 400);
      }

      const updatedCount = await bulkMarkSynced(ids);

      logStream("debug", "Success", "Bulk Mark Synced");
      RES(res, { success: true, message: MESSAGE.TEMP_STORAGE.RESOURCES_SYNCED_SUCCESSFULLY, data: { updatedCount } }, 200);
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, error.code || 500);
    }
  };

  /**
   * DELETE /temp-storage/:resourceType/:resourceId — Delete a resource and cascade-delete its children
   * @param {request} req
   * @param {response} res
   */
  this.deleteResource = async (req, res) => {
    try {
      logStream("debug", "API call", "Delete Resource");
      const { resourceType, resourceId } = req.params;

      const deletedCount = await deleteResource(resourceType, resourceId);
      if (deletedCount === 0) {
        return RES(res, { success: false, message: MESSAGE.TEMP_STORAGE.RESOURCE_NOT_FOUND }, 404);
      }

      logStream("debug", "Success", "Delete Resource");
      RES(res, { success: true, message: MESSAGE.TEMP_STORAGE.RESOURCE_DELETED_SUCCESSFULLY, data: { deletedCount } }, 200);
    } catch (error) {
      logStream("error", error.message);
      RES(res, { success: false, message: error.message }, error.code || 500);
    }
  };

  return this;
})();
