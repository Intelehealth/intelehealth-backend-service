import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { Config } from "@src/models/dic_config.model";
import { AuditTrail } from "@src/models/audit_trail.model";
import { AILLMVoiceTranscript } from "@src/models/mst_ai_llm_voice_transcript";

export const AI_LLM_VOICE_TRANSCRIPT_NOT_FOUND_ERR = "AI LLM Voice Transcript field not found";

async function getAll(): Promise<AILLMVoiceTranscript[]> {
  return await AILLMVoiceTranscript.findAll({ attributes: ["id", "key", "name", "is_enabled", "createdAt", "updatedAt"], order: [["id", "ASC"]], raw: true });
}

async function getByKey(key: string): Promise<AILLMVoiceTranscript | null> {
  return await AILLMVoiceTranscript.findOne({ where: { key: key } });
}

async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
  const aillmVoiceTranscript = await AILLMVoiceTranscript.findOne({ where: { id } });
  if (!aillmVoiceTranscript) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, AI_LLM_VOICE_TRANSCRIPT_NOT_FOUND_ERR);
  }

  if (aillmVoiceTranscript.is_enabled == is_enabled) {
    return;
  }

  await AILLMVoiceTranscript.update({ is_enabled }, { where: { id } });

  const voiceTranscriptConfigs = await AILLMVoiceTranscript.findAll({ attributes: ["key", "is_enabled"], order: [["id", "ASC"]], raw: true });

  const grouped: Record<string, boolean> = {};
  voiceTranscriptConfigs.forEach((item: AILLMVoiceTranscript) => {
    grouped[item.key] = Boolean(item.is_enabled);
  });

  await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: "ai_llm_voice_transcript" } });

  await AuditTrail.create({user_id, user_name, activity_type: "AI LLM VOICE TRANSCRIPT CONFIG UPDATED", description: `${is_enabled ? "Enabled" : "Disabled"} "${aillmVoiceTranscript.key}" config.`});
}

export default {
  getAll,
  getByKey,
  updateIsEnabled,
} as const;
