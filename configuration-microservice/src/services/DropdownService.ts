import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { Dropdown } from '@src/models/mst_dropdown_values.model';
import { AuditTrail } from '@src/models/audit_trail.model';


// **** Variables **** //
export const DROPDOWN_NOT_FOUND_ERR = 'Dropdown field not found';

// **** Functions **** //

/**
 * Get all dropdown fields.
 */
async function getAll(): Promise<any> {
    const dropdowns = await Dropdown.findAll({
        attributes: ['id', 'name', 'key', 'type', 'is_enabled', 'createdAt', 'updatedAt'],
        raw: true
    });
    const groupedDropdowns: any = {}; 
    dropdowns.map((item: Dropdown) => {
        item.is_enabled = Boolean(item.is_enabled);
        if (!groupedDropdowns[item.type.toLowerCase()]) {
            groupedDropdowns[item.type.toLowerCase()] = []
        }
        // Push the dropdown option to the corresponding type group
        groupedDropdowns[item.type.toLowerCase()].push((({ type, ...rest }) => rest)(item));
    });
    return groupedDropdowns;
}

/**
 * Update dropdown enabled status.
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {    
    const dropdown = await Dropdown.findOne({ where: { id } });
    if (!dropdown) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            DROPDOWN_NOT_FOUND_ERR,
        );
    }

    // Check if status is same, if same don't do anything
    if (dropdown.is_enabled == is_enabled) {
        return;
    }

    // Update is_enabled status
    await Dropdown.update({ is_enabled }, { where: { id } });

    // Get all dropdown fields
    const dropdowns = await Dropdown.findAll({
        attributes: ['id', 'name', 'key', 'type', 'is_enabled'],
        raw: true
    });

    const groupedDropdowns: any = {}; 
    dropdowns.map((item: Dropdown) => {
        item.is_enabled = Boolean(item.is_enabled);
        if (!groupedDropdowns[item.type.toLowerCase()]) {
            groupedDropdowns[item.type.toLowerCase()] = []
        }
        // Push the dropdown option to the corresponding type group
        groupedDropdowns[item.type.toLowerCase()].push((({ type, ...rest }) => rest)(item));
    });

    // Update dic_config patient_registration key
    const configRes = await Config.update({ value: JSON.stringify(groupedDropdowns), published: false }, { where: { key: 'dropdown_values' } });
    
    // Insert audit trail entry
    const auditRes = await AuditTrail.create({ user_id, user_name, activity_type: 'DROPDOWN CONFIG UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${dropdown.name}" dropdown config.` });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled
} as const;