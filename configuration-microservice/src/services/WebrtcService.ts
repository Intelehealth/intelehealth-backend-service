import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { Webrtc } from '@src/models/mst_webrtc.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { Features } from '@src/models/mst_features.model';


// **** Variables **** //
export const WEBRTC_NOT_FOUND_ERR = 'Webrtc field not found';

// **** Functions **** //

/**
 * Get all webrtc fields.
 */
async function getAll(): Promise<any> {
    const [webrtc, webrtc_section] = await Promise.all([
        Webrtc.findAll({
            attributes: ['id', 'name', 'key', 'is_enabled', 'createdAt', 'updatedAt', 'platform'],
            raw: true
        }),
        Features.findOne({
            attributes: ['id', 'key', 'name', 'is_enabled'],
            where: { key: 'webrtc_section' }
        })
    ]);
    return {
        webrtc_section: webrtc_section,
        webrtc
    };
}

/**
 * Update webrtc enabled status.
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
    const webrtc = await Webrtc.findOne({ where: { id } });
    if (!webrtc) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            WEBRTC_NOT_FOUND_ERR,
        );
    }

    // Check if status is same, if same don't do anything
    if (webrtc.is_enabled == is_enabled) {
        return;
    }

    // Update is_enabled status
    await Webrtc.update({ is_enabled }, { where: { id } });

    // Get all webrtc config
    const webrtcs = await Webrtc.findAll({
        attributes: ['key', 'is_enabled'],
        raw: true
    });

    const grouped: any = {};
    webrtcs.map((item: Webrtc) => {
        grouped[item.key] = Boolean(item.is_enabled);
    });

    // Update dic_config patient_registration key
    await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: 'webrtc' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'WEBRTC CONFIG UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${webrtc.name}" webrtc config.` });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled
} as const;