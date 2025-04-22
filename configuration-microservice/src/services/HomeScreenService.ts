import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { HomeScreen } from '@src/models/mst_home_screen.model';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';


// **** Variables **** //

export const HOME_SCREEN_SECTION_NOT_FOUND_ERR = 'Home screen section not found';
export const CANT_UPDATE_ENABLED_STATUS_IF_LOCKED = 'Can not update enable status for default compulsory field';
export const CANT_UPDATE_NAME_IF_EDITABLE_FALSE = 'Can update the name, because its not editable';

// **** Functions **** //

/**
 * Get all patient visit section.
 */
function getAll(): Promise<HomeScreen[]> {
    return HomeScreen.findAll({
        attributes: ['id', 'name', 'lang', 'key', 'is_editable', 'is_enabled', 'is_locked', 'createdAt', 'updatedAt', 'label', 'platform'],
        raw: true,
    });
}

/**
 * Update patient visit section enabled status..
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
    const homeScreen = await HomeScreen.findOne({ where: { id } });
    if (!homeScreen) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            HOME_SCREEN_SECTION_NOT_FOUND_ERR,
        );
    }

    // Check if locked, if locked don't do anything
    if (homeScreen.is_locked) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            CANT_UPDATE_ENABLED_STATUS_IF_LOCKED,
        );
    }

    // Check if new status and current status are same or not, if same don't do anything
    if (homeScreen.is_enabled === is_enabled) {
        return;
    }

    // Update enabled status
    await HomeScreen.update({ is_enabled }, { where: { id } });

    // Get enabled sections
    const enabledSections = await HomeScreen.findAll({
        attributes: ['name', 'lang', 'key', 'is_enabled', 'label'],
        where: { is_enabled: true },
    });

    // Update dic_config home_screen
    await Config.update({ value: JSON.stringify(enabledSections), published: false }, { where: { key: 'home_screen' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'HOME SCREEN SECTION ENABLED STATUS UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${homeScreen.name}" home screen section.` });
}

/**
 * Update patient visit section enabled status..
 */
async function updateHomeScreenName(id: string, lang: any, user_id: string, user_name: string): Promise<void> {
    const homeScreen = await HomeScreen.findOne({ where: { id } });
    if (!homeScreen) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            HOME_SCREEN_SECTION_NOT_FOUND_ERR,
        );
    }
    
    // Check if is_editable, if is_editable is false don't do anything
    if (!homeScreen.is_editable) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            CANT_UPDATE_NAME_IF_EDITABLE_FALSE,
        );
    }

    const stringifyLang = JSON.stringify(lang);

    // Check if new status and current status are same or not, if same don't do anything
    if (JSON.stringify(homeScreen.lang) === stringifyLang) {
        return;
    }

    // Update enabled status
    await HomeScreen.update({ lang: lang }, { where: { id } });

    // Get enabled sections
    const enabledSections = await HomeScreen.findAll({
        attributes: ['name', 'lang', 'key', 'is_enabled', 'label'],
        where: { is_enabled: true },
    });
    
    // Update dic_config home_screen
    await Config.update({ value: JSON.stringify(enabledSections), published: false }, { where: { key: 'home_screen' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'HOME SCREEN SECTION NAME UPDATED', description: `Old name ${JSON.stringify(homeScreen.lang)} New Name ${stringifyLang} home screen section.`});
}


// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateHomeScreenName,
} as const;
