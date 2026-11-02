import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { IReq, IRes } from "./types/express/misc";
import { IReqUser } from "./types/types";
import AILLMVoiceTranscriptService from "@src/services/AILLMVoiceTranscriptService";
import FeaturesService from "@src/services/FeaturesService";

async function getAll(_: IReq, res: IRes) {
  const aiLlm = await AILLMVoiceTranscriptService.getAll();
  return res.status(HttpStatusCodes.OK).json({ aiLlm });
}

async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
  const { id } = req.params;
  const { is_enabled } = req.body;
  const { userId, name } = req.user.data;
  await AILLMVoiceTranscriptService.updateIsEnabled(id, is_enabled, userId, name);
  return res.status(HttpStatusCodes.OK).json({ success: true });
}

async function GetByKey(req: IReq, res: IRes) {
  const feature = await FeaturesService.getByKey(req.params.key);
  return res.status(HttpStatusCodes.OK).json({ feature });
}

export default {
  getAll,
  updateIsEnabled,
  GetByKey,
} as const;
