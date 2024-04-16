import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { PatientRegistration } from '@src/models/patient_registration.model';


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
        attributes: ['id', 'name', 'section', 'is_mandatory', 'is_editable', 'is_enabled', 'is_locked', 'createdAt', 'updatedAt'],
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
async function updateIsMandatory(id: string, is_mandatory: boolean): Promise<void> {
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
        attributes: ['name', 'is_mandatory', 'is_editable', 'is_enabled', 'section'],
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
}

/**
 * Update patient registration editable status.
 */
async function updateIsEditable(id: string, is_editable: boolean): Promise<void> {
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
        attributes: ['name', 'is_mandatory', 'is_editable', 'is_enabled', 'section'],
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
}

/**
 * Update patient registration enabled status.
 */
async function updateIsEnabled(id: string, is_enabled: boolean): Promise<void> {
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
        attributes: ['name', 'is_mandatory', 'is_editable', 'is_enabled', 'section'],
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
}

// **** Export default **** //

export default {
    getAll,
    updateIsMandatory,
    updateIsEditable,
    updateIsEnabled
} as const;