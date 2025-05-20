import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { Features } from '@src/models/mst_features.model';


// **** Variables **** //
export const FEATURE_FIELD_NOT_FOUND_ERR = 'Feature field not found';

// **** Functions **** //

/**
 * Get all feature fields.
 */
async function getAll(): Promise<any> {
    const features = await Features.findAll({
        attributes: ['id', 'key', 'name', 'is_enabled', 'createdAt', 'updatedAt', 'platform'],
        raw: true
    });
    return features;
}

/**
 * Get feature fields.
 */
async function getByKey(key: string): Promise<any> {
    return await Features.findOne({ where: { key: key } });
}

/**
 * Update feature enabled status.
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
    const feature = await Features.findOne({ where: { id } });
    if (!feature) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            FEATURE_FIELD_NOT_FOUND_ERR,
        );
    }

    // Check if status is same, if same don't do anything
    if (feature.is_enabled == is_enabled) {
        return;
    }

    // Update is_enabled status
    await Features.update({ is_enabled }, { where: { id } });

    // Get all feature config
    const newFeature = await Features.findOne({ where: { id }});

    // Update dic_config feature configs key
    await Config.update({ value: String(newFeature?.is_enabled ? 1 : 0), published: false }, { where: { key: feature.key } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'FEATURE CONFIG UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${feature.key}" config.` });
}

// **** Export default **** //

export default {
    getAll,
    getByKey,
    updateIsEnabled
} as const;