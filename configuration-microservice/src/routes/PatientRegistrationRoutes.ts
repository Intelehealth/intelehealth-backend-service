import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import PatientRegistrationService from '@src/services/PatientRegistrationService';
import { IReq, IRes } from './types/express/misc';

// **** Functions **** //

/**
 * Get all patient registration fields.
 */
async function getAll(_: IReq, res: IRes) {
    const pr = await PatientRegistrationService.getAll();
    return res.status(HttpStatusCodes.OK).json({ patient_registration: pr });
}

/**
 * Update patient registration field mandatory status.
 */
async function updateIsMandatory(req: IReq<{ is_mandatory: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_mandatory } = req.body;
    await PatientRegistrationService.updateIsMandatory(id, is_mandatory);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

/**
 * Update patient registration field editable status.
 */
async function updateIsEditable(req: IReq<{ is_editable: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_editable } = req.body;
    await PatientRegistrationService.updateIsEditable(id, is_editable);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

/**
 * Update patient registration field enabled status.
 */
async function updateIsEnabled(req: IReq<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    await PatientRegistrationService.updateIsEnabled(id, is_enabled);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

// **** Export default **** //

export default {
    getAll,
    updateIsMandatory,
    updateIsEditable,
    updateIsEnabled
} as const;