import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { PatientRegistration } from '@src/models/patient_registration.model';
import { AuditTrail } from '@src/models/audit_trail.model';


// **** Variables **** //

export const PRF_NOT_FOUND_ERR = 'Patient registration field not found';
export const CANT_UPDATE_MANDATORY_STATUS_IF_LOCKED = 'Can not update mandatory status for default compulsory field';
export const CANT_UPDATE_ENABLED_STATUS_IF_LOCKED = 'Can not update enable status for default compulsory field';

// **** Functions **** //

/**
 * Get all patient registration fields.
 */
async function getAll(): Promise<any> {
    const prf = await PatientRegistration.findAll({
        attributes: ['id', 'name', 'key', 'section', 'is_mandatory', 'is_editable', 'is_enabled', 'is_locked', 'createdAt', 'updatedAt','validations'],
        raw: true
    });
    const grouped: any = {};
    prf.map((item: PatientRegistration) => {
        item.is_mandatory = Boolean(item.is_mandatory);
        item.is_editable = Boolean(item.is_editable);
        item.is_enabled = Boolean(item.is_enabled);
        item.is_locked = Boolean(item.is_locked);
        if (!grouped[item.section.toLowerCase()]) {
            grouped[item.section.toLowerCase()] = [];
        }
        grouped[item.section.toLowerCase()].push((({ section, ...o }) => o)(item));
    });
    return grouped;
}

/**
 * Update patient registration mandatory status.
 */
async function updateIsMandatory(id: string, is_mandatory: boolean, user_id: string, user_name: string): Promise<void> {
    const prf = await PatientRegistration.findOne({ where: { id } });
    if (!prf) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            PRF_NOT_FOUND_ERR,
        );
    }

    // Check if locked, if locked don't do anything
    if (prf.is_locked) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            CANT_UPDATE_MANDATORY_STATUS_IF_LOCKED,
        );
    }

    // Check if status is same, if same don't do anything
    if (prf.is_mandatory == is_mandatory) {
        return;
    }

    // Update mandatory status
    await PatientRegistration.update({ is_mandatory }, { where: { id } });

    // Get all patient registration fields
    const prfs = await PatientRegistration.findAll({
        attributes: ['name', 'key', 'is_mandatory', 'is_editable', 'is_enabled', 'section', 'validations'],
        raw: true
    });

    const grouped: any = {};
    prfs.map((item: PatientRegistration) => {
        item.is_mandatory = Boolean(item.is_mandatory);
        item.is_editable = Boolean(item.is_editable);
        item.is_enabled = Boolean(item.is_enabled);
        if (!grouped[item.section.toLowerCase()]) {
            grouped[item.section.toLowerCase()] = [];
        }
        grouped[item.section.toLowerCase()].push((({ section, ...o }) => o)(item));
    });

    // Update dic_config patient_registration key
    await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: 'patient_registration' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT REGISTRATION FIELD MANDATORY STATUS UPDATED', description: `"${prf.name}" patient registration field marked as ${is_mandatory ? 'mandatory':'not mandatory'}.` });
}

/**
 * Update patient registration editable status.
 */
async function updateIsEditable(id: string, is_editable: boolean, user_id: string, user_name: string): Promise<void> {
    const prf = await PatientRegistration.findOne({ where: { id } });
    if (!prf) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            PRF_NOT_FOUND_ERR,
        );
    }

    // Check if status is same, if same don't do anything
    if (prf.is_editable == is_editable) {
        return;
    }

    // Update mandatory status
    await PatientRegistration.update({ is_editable }, { where: { id } });

    // Get all patient registration fields
    const prfs = await PatientRegistration.findAll({
        attributes: ['name', 'key', 'is_mandatory', 'is_editable', 'is_enabled', 'section', 'validations'],
        raw: true
    });

    const grouped: any = {};
    prfs.map((item: PatientRegistration) => {
        item.is_mandatory = Boolean(item.is_mandatory);
        item.is_editable = Boolean(item.is_editable);
        item.is_enabled = Boolean(item.is_enabled);
        if (!grouped[item.section.toLowerCase()]) {
            grouped[item.section.toLowerCase()] = [];
        }
        grouped[item.section.toLowerCase()].push((({ section, ...o }) => o)(item));
    });

    // Update dic_config patient_registration key
    await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: 'patient_registration' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT REGISTRATION FIELD EDITABLE STATUS UPDATED', description: `"${prf.name}" patient registration field marked as ${is_editable ? 'editable':'not editable'}.` });
}

/**
 * Update patient registration enabled status.
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
    const prf = await PatientRegistration.findOne({ where: { id } });
    if (!prf) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            PRF_NOT_FOUND_ERR,
        );
    }

    // Check if locked, if locked don't do anything
    if (prf.is_locked) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            CANT_UPDATE_ENABLED_STATUS_IF_LOCKED,
        );
    }

    // Check if status is same, if same don't do anything
    if (prf.is_enabled == is_enabled) {
        return;
    }

    // Update mandatory status
    await PatientRegistration.update({ is_enabled }, { where: { id } });

    // Get all patient registration fields
    const prfs = await PatientRegistration.findAll({
        attributes: ['name', 'key', 'is_mandatory', 'is_editable', 'is_enabled', 'section', 'validations'],
        raw: true
    });

    const grouped: any = {};
    prfs.map((item: PatientRegistration) => {
        item.is_mandatory = Boolean(item.is_mandatory);
        item.is_editable = Boolean(item.is_editable);
        item.is_enabled = Boolean(item.is_enabled);
        if (!grouped[item.section.toLowerCase()]) {
            grouped[item.section.toLowerCase()] = [];
        }
        grouped[item.section.toLowerCase()].push((({ section, ...o }) => o)(item));
    });

    // Update dic_config patient_registration key
    await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: 'patient_registration' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT REGISTRATION FIELD STATUS UPDATED', description: `${is_enabled ? 'Enabled':'Disabled'} "${prf.name}" patient registration field.` });
}


/**
 * Update patient reg validations..
 */
async function updateValidations(id: string, validations: any, user_id: string, user_name: string): Promise<void> {
    const prf = await PatientRegistration.findOne({ where: { id } });
    if (!prf) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            PRF_NOT_FOUND_ERR,
        );
    }
    
    const stringifyValidations = JSON.stringify(validations);
    // Check if new validation and current validation are same or not, if same don't do anything
    if (JSON.stringify(prf.validations) === stringifyValidations) {
        return;
    }

    // Update validation
    await PatientRegistration.update({ validations }, { where: { id } });

    // Get all patient registration fields
    const prfs = await PatientRegistration.findAll({
        attributes: ['name', 'key', 'is_mandatory', 'is_editable', 'is_enabled', 'section','validations'],
        raw: true
    });

    const grouped: any = {};
    prfs.map((item: PatientRegistration) => {
        item.is_mandatory = Boolean(item.is_mandatory);
        item.is_editable = Boolean(item.is_editable);
        item.is_enabled = Boolean(item.is_enabled);
        if (!grouped[item.section.toLowerCase()]) {
            grouped[item.section.toLowerCase()] = [];
        }
        grouped[item.section.toLowerCase()].push((({ section, ...o }) => o)(item));
    });

    // Update dic_config patient_visit_sections
    await Config.update({ value: JSON.stringify(grouped), published: false }, { where: { key: 'patient_registration' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT REGISTRATION FIELD VALIDATION UPDATED', description: `Old validation ${JSON.stringify(prf.validations)} New validation ${stringifyValidations} patient registration field.`});
}

// **** Export default **** //

export default {
    getAll,
    updateIsMandatory,
    updateIsEditable,
    updateIsEnabled,
    updateValidations
} as const;