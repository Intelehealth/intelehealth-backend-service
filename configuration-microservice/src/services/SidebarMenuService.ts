import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { SidebarMenu } from '@src/models/mst_sidebar_menu.model';


// **** Variables **** //

export const SIDEBAR_MENU_NOT_FOUND_ERR = 'Sidebar menu section not found';
export const CANT_UPDATE_MANDATORY_STATUS_IF_LOCKED = 'Can not update mandatory status for default compulsory field';

// **** Functions **** //

/**
 * Get all patient visit summary sections.
 */
function getAll(): Promise<SidebarMenu[]> {
    return SidebarMenu.findAll({
        attributes: ['id', 'name', 'is_enabled', 'is_locked', 'createdAt', 'updatedAt'],
        raw: true
    });
}

/**
 * Update sidebar menu enabled status..
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
    const menu = await SidebarMenu.findOne({ where: { id } });
    if (!menu) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            SIDEBAR_MENU_NOT_FOUND_ERR,
        );
    }

    // Check if locked, if locked don't do anything
    if (menu.is_locked) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            CANT_UPDATE_MANDATORY_STATUS_IF_LOCKED,
        );
    }


    // Check if new status and current status are same or not, if same don't do anything
    if (menu.is_enabled === is_enabled) {
        return;
    }

    // Update enabled status
    await SidebarMenu.update({ is_enabled }, { where: { id } });

    // Get sidebar menu sections
    const sections = await SidebarMenu.findAll({
        attributes: ['key', 'is_enabled']
    });

    const data = sections.reduce((acc: any, item: SidebarMenu) => {
        const key = item.key;
        if (!acc[key]) {
            acc[key] = Boolean(item.is_enabled);
        }
        return acc;
    }, {});

    // Update dic_config patient visit summary key 
    await Config.update({ value: JSON.stringify(data), published: false }, { where: { key: 'sidebar_menus' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'SIDEBAR MENU STATUS UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${menu.name}".` });
}


// **** Export default **** //

export default {
    getAll,
    updateIsEnabled
} as const;