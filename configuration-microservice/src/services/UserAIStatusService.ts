import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { Config } from "@src/models/dic_config.model";
import { AuditTrail } from "@src/models/audit_trail.model";
import { UserAIStatus } from "@src/models/mst_user_ai_status.model";

// **** Variables **** //
export const USER_AI_STATUS_NOT_FOUND_ERR = "User AI status record not found";

// **** Functions **** //

/**
 * Get all user AI status records.
 */
async function getAll(): Promise<any> {
  return UserAIStatus.findAll({
    attributes: ["id", "user_uuid", "name", "is_enabled", "createdAt", "updatedAt"],
    raw: true,
  });
}

/**
 * Get user AI status by user uuid.
 */
async function getByUserUuid(user_uuid: string): Promise<any> {
  return UserAIStatus.findOne({ where: { user_uuid } });
}

/**
 * Add or update user AI status record.
 */
async function addOrUpdate(user_uuid: string, name: string, is_enabled: boolean): Promise<UserAIStatus> {
  const existing = await UserAIStatus.findOne({ where: { user_uuid } });
  if (existing) {
    await UserAIStatus.update({ is_enabled, name }, { where: { user_uuid } });
    return UserAIStatus.findOne({ where: { user_uuid } }) as Promise<UserAIStatus>;
  }
  return UserAIStatus.create({ user_uuid, name, is_enabled });
}

/**
 * Update user AI status enabled status.
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
  const record = await UserAIStatus.findOne({ where: { id } });
  if (!record) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, USER_AI_STATUS_NOT_FOUND_ERR);
  }

  // Check if status is same, if same don't do anything
  if (record.is_enabled === is_enabled) {
    return;
  }

  // Update is_enabled status
  await UserAIStatus.update({ is_enabled }, { where: { id } });

  // Get all user AI status records
  const allRecords = await UserAIStatus.findAll({
    attributes: ["user_uuid", "is_enabled"],
    raw: true,
  });

  const grouped: any = {};
  allRecords.map((item: UserAIStatus) => {
    grouped[item.user_uuid] = Boolean(item.is_enabled);
  });

  // Update dic_config user_ai_status key
  const existingConfig = await Config.findOne({ where: { key: "user_ai_status" } });
  if (existingConfig) {
    await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: "user_ai_status" } });
  } else {
    await Config.create({ key: "user_ai_status", value: JSON.stringify(grouped), type: "json", default_value: "{}", published: false });
  }

  // Insert audit trail entry
  await AuditTrail.create({
    user_id,
    user_name,
    activity_type: "USER AI STATUS UPDATED",
    description: `${is_enabled ? "Enabled" : "Disabled"} AI services for user "${record.name}".`,
  });
}

/**
 * Log audit trail entry for user AI status change.
 */
async function logAuditTrail(user_id: string, user_name: string, is_enabled: boolean, target_name: string): Promise<void> {
  await AuditTrail.create({
    user_id,
    user_name,
    activity_type: "USER AI STATUS UPDATED",
    description: `${is_enabled ? "Enabled" : "Disabled"} AI services for user "${target_name}".`,
  });
}

// **** Export default **** //

export default {
  getAll,
  getByUserUuid,
  addOrUpdate,
  updateIsEnabled,
  logAuditTrail,
} as const;
