import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Language } from '@src/models/language.model';
import { Config } from '@src/models/dic_config.model';
import { Op } from 'sequelize';
import { AuditTrail } from '@src/models/audit_trail.model';


// **** Variables **** //

export const LANGUAGE_NOT_FOUND_ERR = 'Language not found';
export const ATLEAST_ONE_LANGUAGE_MUST_BE_ENABLED = 'Atleast one language must be enabled';
export const CANT_DISABLE_DEFAULT_LANGUAGE = 'Default language can not be disabled';
export const CANT_SET_DEFAULT_LANGUAGE = 'Disabled language can not be set as default language';


// **** Functions **** //

/**
 * Get all languages.
 */
function getAll(): Promise<Language[]> {
    return Language.findAll({
        attributes: ['id', 'name', 'code', 'en_name', 'is_default', 'is_enabled', 'createdAt', 'updatedAt', 'platform'],
        raw: true
    });
}

/**
 * Update language enabled status.
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
    const language = await Language.findOne({ where: { id } });
    if (!language) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            LANGUAGE_NOT_FOUND_ERR,
        );
    }

    // Check if new status and current status are same or not, if same don't do anything
    if (language.is_enabled === is_enabled) {
        return;
    }

    if (!is_enabled) {
        // Check if atleast one language must be enabled at any time before disabling it
        const enabledCount = await Language.count({ where: { is_enabled: true } });
        if (enabledCount === 1) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                ATLEAST_ONE_LANGUAGE_MUST_BE_ENABLED,
            );
        }

        // Check if language is not set default before disabling it
        if (language.is_default) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                CANT_DISABLE_DEFAULT_LANGUAGE,
            );
        }
    }

    // Update enabled status
    await Language.update({ is_enabled }, { where: { id } });

    // Get enabled languages
    const enabledLanguages = await Language.findAll({
        attributes: ['name', 'code', 'en_name', 'is_default'],
        where: { is_enabled: true }
    });

    // Update dic_config language key
    await Config.update({ value: JSON.stringify(enabledLanguages), published: false }, { where: { key: 'language' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'LANGUAGE STATUS UPDATED', description: `${is_enabled ? 'Enabled':'Disabled'} "${language.en_name}" language.` });
}

/**
 * Set as default language.
 */
async function setDefault(id: string, user_id: string, user_name: string): Promise<void> {
    const language = await Language.findOne({ where: { id } });
    if (!language) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            LANGUAGE_NOT_FOUND_ERR,
        );
    }

    // Check if language if already set as default
    if (language.is_default) {
        return;
    }

    // Check if language is enabled
    if (!language.is_enabled) {
        throw new RouteError(
            HttpStatusCodes.BAD_REQUEST,
            CANT_SET_DEFAULT_LANGUAGE,
        );
    }

    // Update default status
    await Language.update({ is_default: false }, { where: { id: { [Op.gte]: 1} } });
    await Language.update({ is_default: true }, { where: { id } });

    // Get enabled languages
    const enabledLanguages = await Language.findAll({
        attributes: ['name', 'code', 'en_name', 'is_default'],
        where: { is_enabled: true }
    });

    // Update dic_config language key
    await Config.update({ value: JSON.stringify(enabledLanguages), published: false }, { where: { key: 'language' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'LANGUAGE SET AS DEFAULT', description: `"${language.en_name}" set as default language.` });
}
async function getAllEnabledLanguage(): Promise<Language[]> {
    return Language.findAll({
        attributes: ['id', 'name', 'code', 'en_name', 'is_default', 'is_enabled','platform'],
        where: { 
                is_enabled: true,
                platform: {
                        [Op.in]: ['Webapp', 'Both']
                    }         
                },
        raw: true
    });
}
/**
 * Update language enabled status.
 */
async function updatePlatform(id: string, platform: string, user_id: string, user_name: string): Promise<void> {
  const language = await Language.findOne({ where: { id } });
  if (!language) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, LANGUAGE_NOT_FOUND_ERR);
  }
  if (!language.is_enabled) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Language must be enabled to update platform.');
  }
  // Check if platform is already the same
  if (language.platform === platform) {
    return; 
  }
  // Perform update
  await Language.update({ platform }, { where: { id } });
  const enabledLanguages = await Language.findAll({
        attributes: ['name', 'code', 'en_name', 'is_default', 'platform','is_enabled'],
        where: { is_enabled: true }
    });
  await Config.update({ value: JSON.stringify(enabledLanguages), published: false }, { where: { key: 'language' } });

  // Insert audit trail entry
  await AuditTrail.create({
    user_id,
    user_name,
    activity_type: 'LANGUAGE PLATFORM UPDATED',
    description: `Updated platform for "${language.en_name}" to "${platform}".`
  });
}
// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updatePlatform,
    setDefault,
    getAllEnabledLanguage
} as const;