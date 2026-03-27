import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "./types/express/misc";
import { IReqUser } from "./types/types";
import UserAIStatusService from "@src/services/UserAIStatusService";

// **** Functions **** //

/**
 * Get all user AI status records.
 */
async function getAll(_: IReq, res: IRes) {
  const userAIStatus = await UserAIStatusService.getAll();
  return res.status(HttpStatusCodes.OK).json({ userAIStatus });
}

/**
 * Add a user AI status record.
 */
async function add(req: IReqUser<{ user_uuid: string; name: string; is_enabled: boolean }>, res: IRes) {
  const { user_uuid, name: userName, is_enabled } = req.body;
  const { userId, name } = req.user.data;
  const record = await UserAIStatusService.addOrUpdate(user_uuid, userName, is_enabled);

  // Insert audit trail entry
  await UserAIStatusService.logAuditTrail(userId, name, is_enabled, userName);

  return res.status(HttpStatusCodes.CREATED).json({ success: true, data: record });
}

/**
 * Update user AI status enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
  const { id } = req.params;
  const { is_enabled } = req.body;
  const { userId, name } = req.user.data;
  await UserAIStatusService.updateIsEnabled(id, is_enabled, userId, name);
  return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

// **** Export default **** //

export default {
  getAll,
  add,
  updateIsEnabled,
} as const;
