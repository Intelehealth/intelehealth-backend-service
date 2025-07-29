import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "./types/express/misc";
import { IReqUser } from "./types/types";
import AILLMRecordingService from "@src/services/AILLMRecordingService";
import FeaturesService from "@src/services/FeaturesService";
import { AILLMRecording } from "@src/models/mst_ai_llm_recording";
import { Config } from "@src/models/dic_config.model";

// **** Functions **** //

/**
 * Get all AILLM configs.
 */
async function getAll(_: IReq, res: IRes) {
  const aiLlm = await AILLMRecordingService.getAll();
  return res.status(HttpStatusCodes.OK).json({ aiLlm });
}

/**
 * Update AILLM config enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
  const { id } = req.params;
  const { is_enabled } = req.body;
  const { userId, name } = req.user.data;
  await AILLMRecordingService.updateIsEnabled(id, is_enabled, userId, name);
  return res.status(HttpStatusCodes.OK).json({ success: true });
}

/**
 * Get all feature configs.
 */
async function GetByKey(req: IReq, res: IRes) {
  const feature = await FeaturesService.getByKey(req.params.key);
  return res.status(HttpStatusCodes.OK).json({ feature });
}

/**
 * update video recording feature.
 */
 async function updateIsVideoEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
  const { id } = req.params;
  const { is_enabled } = req.body;
  const { userId, name } = req.user.data;
  await AILLMRecordingService.updateIsVideoEnabled(id,is_enabled, userId, name); 
  return res.status(HttpStatusCodes.OK).json({ success: true });
}
/**
 * update video recording feature.
 */
 async function updateIsAudioEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
  const id  = req.params.id;
  const { is_enabled } = req.body;
    const { userId, name } = req.user.data;

  await AILLMRecordingService.updateIsAudioEnabled(id, is_enabled,userId, name);
  return res.status(HttpStatusCodes.OK).json({ success: true });
}

// **** Export default **** //

export default {
  getAll,
  updateIsEnabled,
  GetByKey,
  updateIsVideoEnabled,
  updateIsAudioEnabled
} as const;
