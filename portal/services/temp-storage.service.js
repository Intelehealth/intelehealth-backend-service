const {
  temp_storage: TempStorage,
  Sequelize,
} = require("../models");
const Op = Sequelize.Op;
const { logStream } = require("../logger/index");
const { uploadFile } = require("../handlers/file.handler");
const AWS = require("aws-sdk");
const {
  SYNC_STATUSES,
  TEMP_STORAGE,
  SORT_ORDER,
  CREATED_AT,
} = require("../constants/constant");

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_BUCKET_NAME,
  TEMP_STORAGE_SYNCED_RETENTION_DAYS,
  TEMP_STORAGE_UNSYNCED_RETENTION_DAYS,
} = process.env;

/**
 * Delete a file from S3 by its URL or key
 * @param {string} fileUrl - full S3 URL or key
 */
const deleteS3File = async (fileUrl) => {
  if (!fileUrl) return;

  AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION,
  });

  const s3 = new AWS.S3();
  const key = fileUrl.includes("http") ? fileUrl.split("/").pop() : fileUrl;

  await new Promise((resolve, reject) => {
    s3.deleteObject(
      { Bucket: AWS_BUCKET_NAME, Key: key },
      (err, data) => {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });
};

module.exports = (function () {
  /**
   * Upsert a resource into temp storage
   * @param {object} payload - { resource_type, resource_id, parent_id, parent_type, data, created_by }
   * @returns {object} - { record, created }
   */
  this.upsertResource = async (payload) => {
    const { resource_type, resource_id, parent_id, parent_type, data, created_by } = payload;

    const [record, created] = await TempStorage.findOrCreate({
      where: { resource_type, resource_id },
      defaults: {
        parent_id,
        parent_type,
        data,
        created_by,
        sync_status: SYNC_STATUSES.PENDING,
      },
    });

    if (!created) {
      await record.update({
        parent_id: parent_id !== undefined ? parent_id : record.parent_id,
        parent_type: parent_type !== undefined ? parent_type : record.parent_type,
        data: data !== undefined ? data : record.data,
        sync_status: SYNC_STATUSES.PENDING,
        synced_at: null,
      });
    }

    return { record, created };
  };

  /**
   * Upsert an asset resource with file upload
   * @param {object} payload - { resource_type, resource_id, parent_id, parent_type, data, created_by }
   * @param {object} file - multer file object
   * @returns {object} - { record, created }
   */
  this.upsertAssetResource = async (payload, file) => {
    const { resource_type, resource_id, parent_id, parent_type, data, created_by } = payload;

    let filePath = null;
    if (file) {
      filePath = await uploadFile(file, null, TEMP_STORAGE.UPLOAD_FOLDER);
    }

    const [record, created] = await TempStorage.findOrCreate({
      where: { resource_type, resource_id },
      defaults: {
        parent_id,
        parent_type,
        data,
        file_path: filePath,
        created_by,
        sync_status: SYNC_STATUSES.PENDING,
      },
    });

    if (!created) {
      const updateData = {
        parent_id: parent_id !== undefined ? parent_id : record.parent_id,
        parent_type: parent_type !== undefined ? parent_type : record.parent_type,
        data: data !== undefined ? data : record.data,
        sync_status: SYNC_STATUSES.PENDING,
        synced_at: null,
      };
      if (filePath) {
        updateData.file_path = filePath;
      }
      await record.update(updateData);
    }

    return { record, created };
  };

  /**
   * Fetch a single resource by type and ID
   * @param {string} resourceType
   * @param {string} resourceId
   * @returns {object|null}
   */
  this.getResource = async (resourceType, resourceId) => {
    return await TempStorage.findOne({
      where: { resource_type: resourceType, resource_id: resourceId },
    });
  };

  /**
   * Fetch child resources of a parent
   * @param {string} parentType - parent's resource_type
   * @param {string} parentId - parent's resource_id
   * @param {string} childType - optional filter by child resource_type
   * @returns {Array}
   */
  this.getChildResources = async (parentType, parentId, childType) => {
    const where = { parent_id: parentId, parent_type: parentType };
    if (childType) {
      where.resource_type = childType;
    }
    return await TempStorage.findAll({ where, order: [[CREATED_AT, SORT_ORDER.ASC]] });
  };

  /**
   * Fetch all pending (unsynced) records with optional filters
   * @param {object} filters - { resourceType, createdBy }
   * @returns {Array}
   */
  this.getPendingResources = async (filters = {}) => {
    const where = { sync_status: SYNC_STATUSES.PENDING };
    if (filters.resourceType) {
      where.resource_type = filters.resourceType;
    }
    if (filters.createdBy) {
      where.created_by = filters.createdBy;
    }
    return await TempStorage.findAll({ where, order: [[CREATED_AT, SORT_ORDER.ASC]] });
  };

  /**
   * Bulk mark records as synced
   * @param {Array<string>} ids - array of record UUIDs
   * @returns {number} - count of updated records
   */
  this.bulkMarkSynced = async (ids) => {
    const [updatedCount] = await TempStorage.update(
      { sync_status: SYNC_STATUSES.SYNCED, synced_at: new Date() },
      { where: { id: { [Op.in]: ids } } }
    );
    return updatedCount;
  };

  /**
   * Delete a resource and cascade-delete its children
   * @param {string} resourceType
   * @param {string} resourceId
   * @returns {number} - total deleted count
   */
  this.deleteResource = async (resourceType, resourceId) => {
    let totalDeleted = 0;

    const children = await TempStorage.findAll({
      where: { parent_id: resourceId, parent_type: resourceType },
    });

    for (const child of children) {
      totalDeleted += await this.deleteResource(child.resource_type, child.resource_id);
    }

    const record = await TempStorage.findOne({
      where: { resource_type: resourceType, resource_id: resourceId },
    });

    if (record && record.file_path) {
      await deleteS3File(record.file_path).catch((err) => {
        logStream("error", `Failed to delete S3 file: ${record.file_path} - ${err.message}`);
      });
    }

    const deletedCount = await TempStorage.destroy({
      where: { resource_type: resourceType, resource_id: resourceId },
    });

    return totalDeleted + deletedCount;
  };

  /**
   * Cleanup stale records (called by cron)
   * - Synced records older than SYNCED_RETENTION_DAYS from synced_at -> purged
   * - Unsynced records older than UNSYNCED_RETENTION_DAYS from createdAt -> purged
   * @returns {object} - { syncedPurged, unsyncedPurged }
   */
  this.cleanupRecords = async () => {
    const syncedRetentionDays = parseInt(
      TEMP_STORAGE_SYNCED_RETENTION_DAYS || String(TEMP_STORAGE.DEFAULT_SYNCED_RETENTION_DAYS),
      10
    );
    const unsyncedRetentionDays = parseInt(
      TEMP_STORAGE_UNSYNCED_RETENTION_DAYS || String(TEMP_STORAGE.DEFAULT_UNSYNCED_RETENTION_DAYS),
      10
    );

    const now = new Date();
    const synced = new Date(now.getTime() - syncedRetentionDays * TEMP_STORAGE.MS_PER_DAY);
    const unsynced = new Date(now.getTime() - unsyncedRetentionDays * TEMP_STORAGE.MS_PER_DAY);

    const syncedRecords = await TempStorage.findAll({
      where: {
        sync_status: SYNC_STATUSES.SYNCED,
        synced_at: { [Op.lt]: synced },
      },
    });

    const unsyncedRecords = await TempStorage.findAll({
      where: {
        sync_status: SYNC_STATUSES.PENDING,
        createdAt: { [Op.lt]: unsynced },
      },
    });

    const allRecords = [...syncedRecords, ...unsyncedRecords];

    for (const record of allRecords) {
      if (record.file_path) {
        await deleteS3File(record.file_path).catch((err) => {
          logStream("error", `Cleanup: Failed to delete S3 file: ${record.file_path} - ${err.message}`);
        });
      }
    }

    // Delete in order: assets -> visits -> patients (children first)
    let syncedPurged = 0;
    let unsyncedPurged = 0;

    for (const type of TEMP_STORAGE.CLEANUP_ORDER) {
      const syncedCount = await TempStorage.destroy({
        where: {
          sync_status: SYNC_STATUSES.SYNCED,
          synced_at: { [Op.lt]: synced },
          resource_type: type,
        },
      });
      syncedPurged += syncedCount;

      const unsyncedCount = await TempStorage.destroy({
        where: {
          sync_status: SYNC_STATUSES.PENDING,
          createdAt: { [Op.lt]: unsynced },
          resource_type: type,
        },
      });
      unsyncedPurged += unsyncedCount;
    }

    logStream("info", `Temp storage cleanup: purged ${syncedPurged} synced, ${unsyncedPurged} unsynced records`);
    return { syncedPurged, unsyncedPurged };
  };

  return this;
})();
