import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { PatientVisitSection } from '@src/models/mst_patient_visit_section.model';
import connection from '@src/database/connection';


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
        attributes: ['id', 'name', 'lang', 'key', 'is_editable', 'is_enabled', 'is_locked', 'order', 'createdAt', 'updatedAt', 'sub_sections'],
        raw: true,
        order: [['order', 'asc']]
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
        attributes: ['name', 'lang', 'key', 'is_enabled', 'order'],
        where: { is_enabled: true },
        order: [['order', 'asc']]
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

    const stringifyName = JSON.stringify(name);
    // Check if new status and current status are same or not, if same don't do anything
    if (JSON.stringify(patientVisitSection.lang) === stringifyName) {
        return;
    }

    // Update enabled status
    await PatientVisitSection.update({ lang: name }, { where: { id } });

    // Get enabled sections
    const enabledSections = await PatientVisitSection.findAll({
        attributes: ['name', 'lang', 'key', 'is_enabled', 'order'],
        where: { is_enabled: true },
        order: [['order', 'asc']]
    });

    // Update dic_config patient_visit_sections
    await Config.update({ value: JSON.stringify(enabledSections), published: false }, { where: { key: 'patient_visit_sections' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT VISIT SECTION NAME UPDATED', description: `Old name ${JSON.stringify(patientVisitSection.lang)} New Name ${stringifyName} patient visit section.`});
}

/**
 * Update patient visit section enabled status..
 */
async function updateOrder(order: any[], user_id: string, user_name: string): Promise<void> {
    const oldArr = await PatientVisitSection.findAll({
        attributes: ['id', 'order'],
        where: { is_enabled: true },
        order: [['order', 'asc']],
        raw: true
    });

    // Function to check if two arrays are equal based on `id` and `order`
    function arraysAreEqual(arr1: any[], arr2: any[]): boolean {
        if (arr1.length !== arr2.length) return false;
        
        const map1 = new Map(arr1.map(obj => [obj.id, obj.order]));
        return arr2.every((obj) => map1.get(obj.id) === obj.order);
    }

    if (arraysAreEqual(oldArr, order)) return;


    const updates = order.map(item => `WHEN id = ${item.id} THEN ${item.order}`).join(' ');

    const query = `UPDATE mst_patient_visit_sections SET \`order\` = CASE ${updates} END WHERE id IN (${order.map(item => item.id).join(', ')});`;
    try {
        await connection.query(query);
        // Get All sections
        const enabledSections = await PatientVisitSection.findAll({
            attributes: ['name', 'lang', 'key', 'is_enabled', 'order'],
            where: { is_enabled: true },
            order: [['order', 'asc']]
        });
        // Update dic_config patient_visit_sections
        await Config.update({ value: JSON.stringify(enabledSections), published: false }, { where: { key: 'patient_visit_sections' } });
        // Insert audit trail entry
        await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT VISIT SECTION ORDER UPDATED', description: `Old order ${JSON.stringify(oldArr)} New Name ${JSON.stringify(order)} patient visit section.`});
    } catch (err) {
        throw err;
    }
    
}

/**
 * Update patient visit sub section enabled status..
 */
async function updateSubSectionIsEnabled(id: string, sub_section: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
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

    //Update sub-sections status
    let sub_sections = patientVisitSection.sub_sections;
    if(sub_sections){
        sub_sections.forEach((obj:any)=>{
            if(obj.name === sub_section){
                obj.is_enabled = is_enabled;
            }
        });
    }

    // Update enabled status
    await PatientVisitSection.update({ sub_sections }, { where: { id } });

    // Get enabled sections
    const enabledSections = await PatientVisitSection.findAll({
        attributes: ['name', 'lang', 'key', 'is_enabled', 'order', 'sub_sections'],
        where: { is_enabled: true }
    });

    // Update dic_config patient_visit_sections
    await Config.update({ value: JSON.stringify(enabledSections), published: false }, { where: { key: 'patient_visit_sections' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT VISIT SECTION ENABLED STATUS UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${sub_section}" patient visit section.` });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateName,
    updateOrder,
    updateSubSectionIsEnabled
} as const;