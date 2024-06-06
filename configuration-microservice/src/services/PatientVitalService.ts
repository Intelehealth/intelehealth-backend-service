import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Vital } from '@src/models/vital.model';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import FeaturesService from './FeaturesService';


// **** Variables **** //

export const VITAL_NOT_FOUND_ERR = 'Patient vital not found';
export const ATLEAST_ONE_VITAL_MUST_BE_ENABLED = 'Project needs to have at least one patient vital selected';
export const CANT_DISABLE_VITAL_SINCE_BMI_ENABLED = "Can't update, Height and Weight are mandatory for calculating BMI";
export const CANT_DISABLE_VITAL_SINCE_WHR_ENABLED = "Can't update, Waist and Hip circumference are mandatory for calculating WHR";
export const CANT_ENABLE_BMI_VITAL = "Can't update, Height and Weight are mandatory for calculating BMI. Please enable Height and Weight vitals and mark them mandatory.";
export const CANT_ENABLE_WHR_VITAL = "Can't update, Waist and Hip circumference are mandatory for calculating WHR. Please enable Waist and Hip circumference vitals and mark them mandatory.";
export const CANT_CHANGE_MANDATORY_STATUS_WHR = "Can't update, Waist and Hip circumference are mandatory for calculating WHR. Please disable WHR.";
export const CANT_CHANGE_MANDATORY_STATUS_BMI = "Can't update, Height and Weight are mandatory for calculating BMI. Please disable BMI.";
export const CANT_CHANGE_MANDATORY_STATUS = "Can't update, vital must be always mandatory.";
export const CANT_CHANGE_SECTION_DISABLED = "Can't update, Vitals section is disabled.";

// **** Functions **** //

/**
 * Get all patient vitals.
 */
function getAll(): Promise<Vital[]> {
    return Vital.findAll({
        attributes: ['id', 'name', 'key', 'uuid', 'is_enabled', 'is_mandatory', 'createdAt', 'updatedAt'],
        raw: true
    });
}

/**
 * Update patient vital enabled status..
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {

    await check_section_status();

    const vital = await Vital.findOne({ where: { id } });
    if (!vital) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            VITAL_NOT_FOUND_ERR,
        );
    }

    // Check if new status and current status are same or not, if same don't do anything
    if (vital.is_enabled === is_enabled) {
        return;
    }

    // Check if atleast one specialization must be enabled at any time before disabling any specialization
    if (!is_enabled) {
        const enabledCount = await Vital.count({ where: { is_enabled: true } });
        if (enabledCount === 1) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                ATLEAST_ONE_VITAL_MUST_BE_ENABLED,
            );
        }
    }

    if ((vital.name === 'Height (cm)' || vital.name === 'Weight (kg)') && !is_enabled) {
        const bmi = await Vital.findOne({ where: { name: 'BMI' } });
        if (bmi?.is_enabled) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                CANT_DISABLE_VITAL_SINCE_BMI_ENABLED,
            );
        }
    }

    if (vital.name === 'BMI' && is_enabled) {
        const height = await Vital.findOne({ where: { name: 'Height (cm)' } });
        const weight = await Vital.findOne({ where: { name: 'Weight (kg)' } });
        if (!(height?.is_enabled && weight?.is_enabled && height?.is_mandatory && weight?.is_mandatory)) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                CANT_ENABLE_BMI_VITAL,
            );
        }
    }

    if ((vital.name === 'Waist Circumference (cm)' || vital.name === 'Hip Circumference (cm)') && !is_enabled) {
        const whr = await Vital.findOne({ where: { name: 'Waist to Hip Ratio (WHR)' } });
        if (whr?.is_enabled) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                CANT_DISABLE_VITAL_SINCE_WHR_ENABLED,
            );
        }
    }

    if (vital.name === 'Waist to Hip Ratio (WHR)' && is_enabled) {
        const w = await Vital.findOne({ where: { name: 'Waist Circumference (cm)' } });
        const h = await Vital.findOne({ where: { name: 'Hip Circumference (cm)' } });
        if (!(w?.is_enabled && h?.is_enabled && w?.is_mandatory && h?.is_mandatory)) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                CANT_ENABLE_WHR_VITAL,
            );
        }
    }

    // Update enabled status
    await Vital.update({ is_enabled }, { where: { id } });

    // Get enabled specializations
    const enabledVitals = await Vital.findAll({
        attributes: ['name', 'key', 'uuid', 'is_mandatory'],
        where: { is_enabled: true }
    });

    // Update dic_config specialization
    await Config.update({ value: JSON.stringify(enabledVitals), published: false }, { where: { key: 'patient_vitals' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'VITAL ENABLED STATUS UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${vital.name}" patient vital.` });
}

/**
 * Update patient vital enabled status..
 */
async function updateIsMandatory(id: string, is_mandatory: boolean, user_id: string, user_name: string): Promise<void> {

    await check_section_status();

    const vital = await Vital.findOne({ where: { id } });
    if (!vital) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            VITAL_NOT_FOUND_ERR,
        );
    }

    // Check if new status and current status are same or not, if same don't do anything
    if (vital.is_mandatory === is_mandatory) {
        return;
    }

    if ((vital.name === 'Height (cm)' || vital.name === 'Weight (kg)') && !is_mandatory) {
        const bmi = await Vital.findOne({ where: { name: 'BMI' } });
        if (bmi?.is_enabled) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                CANT_CHANGE_MANDATORY_STATUS_BMI,
            );
        }
    }

    if ((vital.name === 'Waist Circumference (cm)' || vital.name === 'Hip Circumference (cm)') && !is_mandatory) {
        const whr = await Vital.findOne({ where: { name: 'Waist to Hip Ratio (WHR)' } });
        if (whr?.is_enabled) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                CANT_CHANGE_MANDATORY_STATUS_WHR,
            );
        }
    }

    if ((vital.name === 'BMI' || vital.name === 'Waist to Hip Ratio (WHR)') && !is_mandatory) {
        throw new RouteError(
            HttpStatusCodes.BAD_REQUEST,
            CANT_CHANGE_MANDATORY_STATUS,
        );
    }

    // Update enabled status
    await Vital.update({ is_mandatory }, { where: { id } });

    // Get enabled specializations
    const enabledVitals = await Vital.findAll({
        attributes: ['name', 'key', 'uuid', 'is_mandatory'],
        where: { is_mandatory: true }
    });

    // Update dic_config specialization
    await Config.update({ value: JSON.stringify(enabledVitals), published: false }, { where: { key: 'patient_vitals' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'VITAL MANDATORY STATUS UPDATED', description: `"${vital.name}" patient vital field marked as ${is_mandatory ? 'mandatory':'not mandatory'}.` });
}

/**
 * Check if section in disabled or not
 */
async function check_section_status(){
    //Check if section in disabled then don't allow to update the vitals status
    const vital_section = await FeaturesService.getByName("patient_vitals_section");
    if(vital_section && vital_section.is_enabled === false) {
        throw new RouteError(
            HttpStatusCodes.BAD_REQUEST,
            CANT_CHANGE_SECTION_DISABLED,
        );
    }
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateIsMandatory,
} as const;