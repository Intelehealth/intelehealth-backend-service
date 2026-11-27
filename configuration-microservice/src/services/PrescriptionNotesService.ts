import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { PrescriptionNotes } from '@src/models/mst_prescription_notes.model';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { Features } from '@src/models/mst_features.model';

// **** Variables **** //

export const PRESCRIPTION_NOTES_NOT_FOUND_ERR = 'Prescription notes entry not found';
export const NOTES_MUST_BE_NON_EMPTY_ARRAY = 'Notes must be a non-empty array of strings';

// **** Helpers **** //

/**
 * Re-write the `prescription_notes` key in dic_config so that the
 * doctor webapp picks up the latest specialty notes on next publish.
 */
async function syncToDicConfig(): Promise<void> {
    const rows = await PrescriptionNotes.findAll({
        attributes: ['specialty', 'notes', 'is_enabled'],
        order: [['specialty', 'ASC']],
        raw: true,
    });
    await Config.update(
        { value: JSON.stringify(rows), published: false },
        { where: { key: 'prescription_notes' } }
    );
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((v) => typeof v === 'string' && v.trim().length > 0);
}

// **** Functions **** //

/**
 * Get the section master toggle together with all specialty prescription notes.
 * Mirrors the WebRTC pattern: the section flag lives in mst_features under the
 * key 'prescription_notes_section', and per-specialty rows live in mst_prescription_notes.
 */
async function getAll(): Promise<{
    prescription_notes_section: Features | null;
    prescription_notes: PrescriptionNotes[];
}> {
    const [prescription_notes_section, prescription_notes] = await Promise.all([
        Features.findOne({
            attributes: ['id', 'key', 'name', 'is_enabled'],
            where: { key: 'prescription_notes_section' },
        }),
        PrescriptionNotes.findAll({
            attributes: ['id', 'specialty', 'notes', 'is_enabled', 'platform', 'createdAt', 'updatedAt'],
            order: [['specialty', 'ASC']],
            raw: true,
        }),
    ]);
    return { prescription_notes_section, prescription_notes };
}

/**
 * Toggle is_enabled for a specialty's notes.
 */
async function updateIsEnabled(
    id: string,
    is_enabled: boolean,
    user_id: string,
    user_name: string
): Promise<void> {
    const row = await PrescriptionNotes.findOne({ where: { id } });
    if (!row) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, PRESCRIPTION_NOTES_NOT_FOUND_ERR);
    }

    if (row.is_enabled === is_enabled) {
        return;
    }

    await PrescriptionNotes.update({ is_enabled }, { where: { id } });
    await syncToDicConfig();

    await AuditTrail.create({
        user_id,
        user_name,
        activity_type: 'PRESCRIPTION NOTES ENABLED STATUS UPDATED',
        description: `${is_enabled ? 'Enabled' : 'Disabled'} prescription notes for "${row.specialty}".`,
    });
}

/**
 * Replace the notes content (array of bullets) for a specialty.
 */
async function updateNotes(
    id: string,
    notes: unknown,
    user_id: string,
    user_name: string
): Promise<void> {
    if (!isStringArray(notes) || notes.length === 0) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, NOTES_MUST_BE_NON_EMPTY_ARRAY);
    }

    const row = await PrescriptionNotes.findOne({ where: { id } });
    if (!row) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, PRESCRIPTION_NOTES_NOT_FOUND_ERR);
    }

    const previous = JSON.stringify(row.notes);
    const next = JSON.stringify(notes);
    if (previous === next) {
        return;
    }

    await PrescriptionNotes.update({ notes }, { where: { id } });
    await syncToDicConfig();

    await AuditTrail.create({
        user_id,
        user_name,
        activity_type: 'PRESCRIPTION NOTES CONTENT UPDATED',
        description: `Updated prescription notes for "${row.specialty}". Items changed from ${row.notes.length} to ${notes.length}.`,
    });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateNotes,
} as const;
