import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { Config } from "@src/models/dic_config.model";
import { AuditTrail } from "@src/models/audit_trail.model";
import { AILLM } from "@src/models/mst_ai_llm";

// **** Variables **** //
export const AI_LLM_NOT_FOUND_ERR = "AI LLM field not found";

// **** Functions **** //

/**
* Get all AILLM fields.
*/
async function getAll(): Promise<any> {
  const aillm = await AILLM.findAll({ attributes: ["id", "key", "name", "is_enabled", "createdAt", "updatedAt"], raw: true });
  return aillm;
}

/**
* Get AILLM fields.
*/
async function getByKey(key: string): Promise<any> {
  return await AILLM.findOne({ where: { key: key } });
}

/**
* Update AILLM enabled status.
*/
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
  const aillm = await AILLM.findOne({ where: { id } });
  if (!aillm) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, AI_LLM_NOT_FOUND_ERR);
  }

  // Check if status is same, if same don't do anything
  if (aillm.is_enabled == is_enabled) {
    return;
  }

  // Update is_enabled status
  await AILLM.update({ is_enabled }, { where: { id } });

  // Get all AILLM config
  const aiLlm = await AILLM.findAll({ attributes: ["key", "is_enabled"], raw: true });

  const grouped: any = {};
  aiLlm.map((item: AILLM) => {
    grouped[item.key] = Boolean(item.is_enabled);
  });

  // Update dic_config feature configs key
  await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: "ai_llm" } });

  // Insert audit trail entry
  await AuditTrail.create({user_id, user_name, activity_type: "AI LLM CONFIG UPDATED", description: `${is_enabled ? "Enabled" : "Disabled"} "${aillm.key}" config.`});
}

// **** Export default **** //

export default {
  getAll,
  getByKey,
  updateIsEnabled,
} as const;