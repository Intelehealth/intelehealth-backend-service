import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import PrescriptionNotesService from '@src/services/PrescriptionNotesService';
import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';

// **** Functions **** //

/**
 * Get the section master toggle together with all specialty prescription notes.
 */
async function getAll(_: IReq, res: IRes) {
    const data = await PrescriptionNotesService.getAll();
    return res.status(HttpStatusCodes.OK).json(data);
}

/**
 * Toggle is_enabled for a specialty's prescription notes.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await PrescriptionNotesService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

/**
 * Replace the notes array for a specialty.
 */
async function updateNotes(req: IReqUser<{ notes: string[] }>, res: IRes) {
    const { id } = req.params;
    const { notes } = req.body;
    const { userId, name } = req.user.data;
    await PrescriptionNotesService.updateNotes(id, notes, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateNotes,
} as const;
