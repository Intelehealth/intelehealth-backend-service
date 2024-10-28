import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { PatientVisitSummary } from '@src/models/patient_visit_summary.model';
import connectionOpenmrs from '@src/database/connection-openmrs';


// **** Variables **** //

export const PVS_NOT_FOUND_ERR = 'Patient visit summary section not found';
export const PRIORITY_VISIT_PENDING = 'Priority visits pending';

// **** Functions **** //

/**
 * Get all patient visit summary sections.
 */
function getAll(): Promise<PatientVisitSummary[]> {
    return PatientVisitSummary.findAll({
        attributes: ['id', 'name', 'is_enabled', 'createdAt', 'updatedAt'],
        raw: true
    });
}

/**
 * Update patient visit summary enabled status..
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
    const pvs = await PatientVisitSummary.findOne({ where: { id } });
    if (!pvs) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            PVS_NOT_FOUND_ERR,
        );
    }

    // Check if new status and current status are same or not, if same don't do anything
    if (pvs.is_enabled === is_enabled) {
        return;
    }

    // Check if not a single priority visit should be pending before disabling priority visit section
    if (!is_enabled && pvs.name === 'Priority Visit Section') {
        const [results, metadata] = await getPriorityVisitCount();
        const priority_visit_count = results.filter((item: any) => item.status == 'Priority').length;
        if (priority_visit_count > 0) {
            throw new RouteError(
                HttpStatusCodes.BAD_REQUEST,
                PRIORITY_VISIT_PENDING,
            );
        }
    }

    // Update enabled status
    await PatientVisitSummary.update({ is_enabled }, { where: { id } });

    // Get patient visit summary sections
    const sections = await PatientVisitSummary.findAll({
        attributes: ['name', 'is_enabled']
    });

    const data = sections.reduce((acc: any, item: PatientVisitSummary) => {
        const key = item.name.replace(new RegExp(' ', 'g'),'_').toLowerCase();
        if (!acc[key]) {
            acc[key] = Boolean(item.is_enabled);
        }
        return acc;
    }, {});

    // Update dic_config patient visit summary key 
    await Config.update({ value: JSON.stringify(data), published: false }, { where: { key: 'patient_visit_summary' } });

    // Insert audit trail entry
    await AuditTrail.create({ user_id, user_name, activity_type: 'PATIENT VISIT SUMMARY SECTION STATUS UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${pvs.name}".` });
}

/**
 * Get priority visits count.
 */
function getPriorityVisitCount(): Promise<any[]> {
    return connectionOpenmrs.query(`
        SELECT
            t1.visit_id,
            t1.uuid,
            case
                when (ended = 1) then "Ended Visit"
                when (
                    encounter_type = 14
                    or encounter_type = 12
                    or com_enc = 1
                ) then "Completed Visit"
                when (encounter_type = 9) then "Visit In Progress"
                when (encounter_type) = 15 then "Priority"
                when (
                    (
                        encounter_type = 1
                        or encounter_type = 6
                    )
                ) then "Awaiting Consult"
            end as "status",
            t1.speciality
        FROM
            encounter,
            (
                SELECT
                    v.visit_id,
                    v.patient_id,
                    v.uuid,
                    max(encounter_id) as max_enc,
                    max(
                        case
                            when (encounter_type in (12, 14)) then 1
                            else 0
                        end
                    ) as com_enc,
                    max(
                        case
                            when attribute_type_id = 5 then value_reference
                            else null
                        end
                    ) as "speciality",
                    max(
                        case
                            when (v.date_stopped is not null) then 1
                            else 0
                        end
                    ) as ended
                FROM
                    visit v
                    LEFT JOIN encounter e using (visit_id)
                    LEFT JOIN visit_attribute va on (va.visit_id= v.visit_id and va.voided = 0 and va.attribute_type_id = 5)
                WHERE
                    v.voided = 0
                    and e.voided = 0
                GROUP BY
                    v.visit_id,
                    v.patient_id
            ) as t1
        WHERE
            encounter_id = max_enc`);
}

// **** Export default **** //

export default {
    getAll,
    getPriorityVisitCount,
    updateIsEnabled
} as const;