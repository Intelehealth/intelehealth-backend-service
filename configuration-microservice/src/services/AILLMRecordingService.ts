import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { Config } from "@src/models/dic_config.model";
import { AuditTrail } from "@src/models/audit_trail.model";
import { AILLMRecording } from "@src/models/mst_ai_llm_recording";

// **** Variables **** //
export const AI_LLM_RECORDING_NOT_FOUND_ERR = "AI LLM Recording field not found";

// **** Functions **** //

/**
* Get all AILLM fields.
*/
async function getAll(): Promise<any> {
  const aillm = await AILLMRecording.findAll({ attributes: ["id", "key", "name", "is_enabled", "is_video","is_audio","createdAt", "updatedAt"], raw: true });
  return aillm;
}

/**
* Get AILLM fields.
*/
async function getByKey(key: string): Promise<any> {
  return await AILLMRecording.findOne({ where: { key: key } });
}

/**
* Update AILLM enabled status.
*/
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
  const aillmRecording = await AILLMRecording.findOne({ where: { id } });
  if (!aillmRecording) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, AI_LLM_RECORDING_NOT_FOUND_ERR);
  }

  // Check if status is same, if same don't do anything
  if (aillmRecording.is_enabled == is_enabled) {
    return;
  }

  // Update is_enabled status
  await AILLMRecording.update({ is_enabled }, { where: { id } });

  // Get all AILLM config
  const aiLlmRecording = await AILLMRecording.findAll({ attributes: ["key", "is_enabled"], raw: true });

  const grouped: any = {};
  aiLlmRecording.map((item: AILLMRecording) => {
    grouped[item.key] = Boolean(item.is_enabled);
  });

  // Update dic_config feature configs key
  await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: "ai_llm" } });

  // Insert audit trail entry
  await AuditTrail.create({user_id, user_name, activity_type: "AI LLM CONFIG UPDATED", description: `${is_enabled ? "Enabled" : "Disabled"} "${aillmRecording.key}" config.`});
}

/**
* Update AILLM video enabled status.
*/
async function updateIsVideoEnabled(id:string,is_video: boolean, user_id: string, user_name: string): Promise<void> {
  const aillmRecording = await AILLMRecording.findOne({ where: { id } });
  if (!aillmRecording) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, AI_LLM_RECORDING_NOT_FOUND_ERR);
  }
  // Update is_video status
  const [affectedRows] = await AILLMRecording.update({ is_video:is_video }, { where: { id } });
  if (affectedRows === 0) {
    throw new Error("Update failed: No rows affected.");
  }
  // Get all AILLMRecording config
    const aiLlm = await AILLMRecording.findAll({ attributes: ["key","is_video","is_audio"], raw: true });
    const grouped: any = {};
   aiLlm.forEach((item: any) => {
  if (item.is_video !== undefined) {
    grouped['ai_video'] = Boolean(item.is_video);
  }
  if (item.is_audio !== undefined) {
    grouped['ai_audio'] = Boolean(item.is_audio);
  }
});
    // Update dic_config feature configs key
    await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: "ai_llm_recording" } });
await AuditTrail.create({user_id, user_name, activity_type: "AI AUDIO RECORDING UPDATED", description: `${is_video ? "Enabled" : "Disabled"} "${aillmRecording.key}" config.`});
}
/**
* Update AILLM enabled status.
*/
async function updateIsAudioEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
  const aillmRecording = await AILLMRecording.findOne({ where: { id } });
  if (!aillmRecording) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, AI_LLM_RECORDING_NOT_FOUND_ERR);
  }
  // Update is_enabled status
  await AILLMRecording.update({ is_audio: is_enabled }, { where: { id } });
    // Get all AILLMRecording config
    const aiLlm = await AILLMRecording.findAll({ attributes: ["key", "is_video","is_audio"], raw: true });
    const grouped: any = {};
aiLlm.forEach((item: any) => {
  if (item.is_video !== undefined) 
    grouped['ai_video'] = Boolean(item.is_video);
  if (item.is_audio !== undefined) 
    grouped['ai_audio'] = Boolean(item.is_audio);
  
});
    // Update dic_config feature configs key
      await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: "ai_llm_recording" } });
   // Insert audit trail entry
await AuditTrail.create({user_id, user_name, activity_type: "AI AUDIO RECORDING UPDATED", description: `${is_enabled ? "Enabled" : "Disabled"} "${aillmRecording.key}" config.`});

}
export default {
  getAll,
  getByKey,
  updateIsEnabled,
  updateIsVideoEnabled,
  updateIsAudioEnabled
} as const;