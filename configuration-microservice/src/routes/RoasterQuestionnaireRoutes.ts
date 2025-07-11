import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import { IReq, IRes } from "./types/express/misc";
import { IReqUser } from "./types/types";
import RoasterQuestionnaireService from "@src/services/RoasterQuestionnaireService";
import FeaturesService from "@src/services/FeaturesService";

// **** Functions **** //

/**
 * Get all rosterQuestionnaire configs.
 */
async function getAll(_: IReq, res: IRes) {
  const rosterQuestionnaire = await RoasterQuestionnaireService.getAll();
  return res.status(HttpStatusCodes.OK).json({ rosterQuestionnaire });
}

/**
 * Update rosterQuestionnaire config enabled status.
 */
async function updateIsEnabled(
  req: IReqUser<{ is_enabled: boolean }>,
  res: IRes
) {
  const { id } = req.params;
  const { is_enabled } = req.body;
  const { userId, name } = req.user.data;
  await RoasterQuestionnaireService.updateIsEnabled(
    id,
    is_enabled,
    userId,
    name
  );
  return res.status(HttpStatusCodes.OK).json({ success: true });
}

/**
 * Get all feature configs.
 */
async function GetByKey(req: IReq, res: IRes) {
  const feature = await FeaturesService.getByKey(req.params.key);
  return res.status(HttpStatusCodes.OK).json({ feature });
}

// **** Export default **** //

export default {
  getAll,
  updateIsEnabled,
  GetByKey,
} as const;
