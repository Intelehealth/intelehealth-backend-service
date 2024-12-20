import { RouteError } from "@src/other/classes";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { Config } from "@src/models/dic_config.model";
import { AuditTrail } from "@src/models/audit_trail.model";
import { RosterQuestionnaire } from "@src/models/mst_roster_questionnaire";

// **** Variables **** //
export const ROSTER_QUESTIONNAIRE_NOT_FOUND_ERR =
  "Roster Questionnaire field not found";

// **** Functions **** //

/**
 * Get all rosterQuestionnaire fields.
 */
async function getAll(): Promise<any> {
  const rosterQuestionnaire = await RosterQuestionnaire.findAll({
    attributes: ["id", "key", "name", "is_enabled", "createdAt", "updatedAt"],
    raw: true,
  });
  return rosterQuestionnaire;
}

/**
 * Get rosterQuestionnaire fields.
 */
async function getByKey(key: string): Promise<any> {
  return await RosterQuestionnaire.findOne({ where: { key: key } });
}

/**
 * Update rosterQuestionnaire enabled status.
 */
async function updateIsEnabled(
  id: string,
  is_enabled: boolean,
  user_id: string,
  user_name: string
): Promise<void> {
  const rosterQuestionnaire = await RosterQuestionnaire.findOne({
    where: { id },
  });
  if (!rosterQuestionnaire) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      ROSTER_QUESTIONNAIRE_NOT_FOUND_ERR
    );
  }

  // Check if status is same, if same don't do anything
  if (rosterQuestionnaire.is_enabled == is_enabled) {
    return;
  }

  // Update is_enabled status
  await RosterQuestionnaire.update({ is_enabled }, { where: { id } });

  // Get all rosters config
  const rosters = await RosterQuestionnaire.findAll({
    attributes: ["key", "is_enabled"],
    raw: true,
  });

  const grouped: any = {};
  rosters.map((item: RosterQuestionnaire) => {
    grouped[item.key] = Boolean(item.is_enabled);
  });

  // Update dic_config feature configs key
  await Config.update(
    { value: JSON.stringify(grouped), published: false },
    { where: { key: "roster_questionnaire" } }
  );

  // Insert audit trail entry
  await AuditTrail.create({
    user_id,
    user_name,
    activity_type: "ROSTER QUESTIONNAIRE CONFIG UPDATED",
    description: `${is_enabled ? "Enabled" : "Disabled"} "${
      rosterQuestionnaire.key
    }" config.`,
  });
}

// **** Export default **** //

export default {
  getAll,
  getByKey,
  updateIsEnabled,
} as const;
