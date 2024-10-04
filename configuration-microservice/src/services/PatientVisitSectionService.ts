import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { PatientVisitSection } from '@src/models/mst_patient_visit_section.model';


// **** Variables **** //

export const PATIENT_VISIT_SECTION_NOT_FOUND_ERR = 'Patient visit section not found';
export const CANT_UPDATE_ENABLED_STATUS_IF_LOCKED = 'Can not update enable status for default compulsory field';
export const CANT_UPDATE_NAME_IF_EDITABLE_FALSE = 'Can update the name, because its not editable';

// **** Functions **** //

/**
 * Get all patient visit section.
 */
function getAll(): Promise<PatientVisitSection[]> {
    return PatientVisitSection.findAll({
        attributes: ['id', 'name', 'key', 'is_editable', 'is_enabled', 'is_locked', 'order', 'createdAt', 'updatedAt'],
        raw: true
    });
}

/**
 * Update patient visit section enabled status..
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
    const patientVisitSection = await PatientVisitSection.findOne({ where: { id } });
    if (!patientVisitSection) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            PATIENT_VISIT_SECTION_NOT_FOUND_ERR,
        );
    }

    // Check if locked, if locked don't do anything
    if (patientVisitSection.is_locked) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            CANT_UPDATE_ENABLED_STATUS_IF_LOCKED,
        );
    }

    // Check if new status and current status are same or not, if same don't do anything
    if (patientVisitSection.is_enabled === is_enabled) {
        return;
    }

    // Update enabled status
    await PatientVisitSection.update({ is_enabled }, { where: { id } });

    // Get enabled sections
    const enabledSections = await PatientVisitSection.findAll({
        attributes: ['name', 'key', 'is_enabled', 'order'],
        where: { is_enabled: true }
    });

    // Update dic_config patient_visit_sections
    await Config.update({ value: JSON.stringify(enabledSections), published: false }, { where: { key: 'patient_visit_sections' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT VISIT SECTION ENABLED STATUS UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${patientVisitSection.name}" patient visit section.` });
}

/**
 * Update patient visit section enabled status..
 */
async function updateName(id: string, name: any, user_id: string, user_name: string): Promise<void> {
    const patientVisitSection = await PatientVisitSection.findOne({ where: { id } });
    if (!patientVisitSection) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            PATIENT_VISIT_SECTION_NOT_FOUND_ERR,
        );
    }
    
    // Check if is_editable, if is_editable is false don't do anything
    if (!patientVisitSection.is_editable) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            CANT_UPDATE_NAME_IF_EDITABLE_FALSE,
        );
    }

    // Check if new status and current status are same or not, if same don't do anything
    if (JSON.stringify(patientVisitSection.name) === JSON.stringify(name)) {
        return;
    }

    // Update enabled status
    await PatientVisitSection.update({ name: name }, { where: { id } });

    // Get enabled sections
    const enabledSections = await PatientVisitSection.findAll({
        attributes: ['name', 'key', 'is_enabled', 'order'],
        where: { is_enabled: true }
    });

    // Update dic_config patient_visit_sections
    await Config.update({ value: JSON.stringify(enabledSections), published: false }, { where: { key: 'patient_visit_sections' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT VISIT SECTION ENABLED STATUS UPDATED', description: `Old name ${JSON.stringify(patientVisitSection.name)} New Name ${JSON.stringify(name)} patient visit section.`});
}


// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateName
} as const;