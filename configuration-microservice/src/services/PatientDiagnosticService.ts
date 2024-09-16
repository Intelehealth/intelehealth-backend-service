import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Diagnostics } from '@src/models/diagnostics.model';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';

// **** Variables **** //

export const DIAGNOSTIC_NOT_FOUND_ERR = 'Patient diagnostic not found';
export const ATLEAST_ONE_DIAGNOSTIC_MUST_BE_ENABLED = 'Project needs to have at least one patient diagnostic selected';
export const CANT_DISABLE_DIAGNOSTIC_SINCE_BMI_ENABLED = "Can't update, Height and Weight are mandatory for calculating BMI";
export const CANT_DISABLE_DIAGNOSTIC_SINCE_WHR_ENABLED = "Can't update, Waist and Hip circumference are mandatory for calculating WHR";
export const CANT_ENABLE_BMI_DIAGNOSTIC = "Can't update, Height and Weight are mandatory for calculating BMI. Please enable Height and Weight diagnostics and mark them mandatory.";
export const CANT_ENABLE_WHR_DIAGNOSTIC = "Can't update, Waist and Hip circumference are mandatory for calculating WHR. Please enable Waist and Hip circumference diagnostics and mark them mandatory.";
export const CANT_CHANGE_MANDATORY_STATUS_WHR = "Can't update, Waist and Hip circumference are mandatory for calculating WHR. Please disable WHR.";
export const CANT_CHANGE_MANDATORY_STATUS_BMI = "Can't update, Height and Weight are mandatory for calculating BMI. Please disable BMI.";
export const CANT_CHANGE_MANDATORY_STATUS = "Can't update, diagnostic must be always mandatory.";

// **** Functions **** //

/**
 * Get all patient diagnostics.
 */
function getAll(): Promise<Diagnostics[]> {
    return Diagnostics.findAll({
        attributes: ['id', 'name', 'key', 'uuid', 'is_enabled', 'is_mandatory', 'createdAt', 'updatedAt'],
        raw: true
    });
}

/**
 * Update patient diagnostic enabled status..
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
    const diagnostic = await Diagnostics.findOne({ where: { id } });
    if (!diagnostic) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            DIAGNOSTIC_NOT_FOUND_ERR,
        );
    }

    // Check if new status and current status are same or not, if same don't do anything
    if (diagnostic.is_enabled === is_enabled) {
        return;
    }

    // Check if atleast one specialization must be enabled at any time before disabling any specialization
    if (!is_enabled) {
        const enabledCount = await Diagnostics.count({ where: { is_enabled: true } });
        if (enabledCount === 1) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                ATLEAST_ONE_DIAGNOSTIC_MUST_BE_ENABLED,
            );
        }
    }

    // Update enabled status
    await Diagnostics.update({ is_enabled }, { where: { id } });

    // Get enabled specializations
    const enabledDiagnostics = await Diagnostics.findAll({
        attributes: ['name', 'key', 'uuid', 'is_mandatory'],
        where: { is_enabled: true }
    });

    // Update dic_config specialization
    await Config.update({ value: JSON.stringify(enabledDiagnostics), published: false }, { where: { key: 'patient_diagnostics' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'DIAGNOSTIC ENABLED STATUS UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${diagnostic.name}" patient diagnostic.` });
}

/**
 * Update patient diagnostic enabled status..
 */
async function updateIsMandatory(id: string, is_mandatory: boolean, user_id: string, user_name: string): Promise<void> {
    const diagnostic = await Diagnostics.findOne({ where: { id } });
    if (!diagnostic) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            DIAGNOSTIC_NOT_FOUND_ERR,
        );
    }

    // Check if new status and current status are same or not, if same don't do anything
    if (diagnostic.is_mandatory === is_mandatory) {
        return;
    }

    // Update enabled status
    await Diagnostics.update({ is_mandatory }, { where: { id } });

    // Get enabled specializations
    const enabledDiagnostics = await Diagnostics.findAll({
        attributes: ['name', 'key', 'uuid', 'is_mandatory'],
        where: { is_mandatory: true }
    });

    // Update dic_config specialization
    await Config.update({ value: JSON.stringify(enabledDiagnostics), published: false }, { where: { key: 'patient_diagnostics' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'DIAGNOSTIC MANDATORY STATUS UPDATED', description: `"${diagnostic.name}" patient diagnostic field marked as ${is_mandatory ? 'mandatory':'not mandatory'}.` });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateIsMandatory,
} as const;
