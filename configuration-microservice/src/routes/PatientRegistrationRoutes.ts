import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import PatientRegistrationService from '@src/services/PatientRegistrationService';
import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';

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
async function updateIsMandatory(req: IReqUser<{ is_mandatory: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_mandatory } = req.body;
    const { userId, name } = req.user.data;
    await PatientRegistrationService.updateIsMandatory(id, is_mandatory, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

/**
 * Update patient registration field editable status.
 */
async function updateIsEditable(req: IReqUser<{ is_editable: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_editable } = req.body;
    const { userId, name } = req.user.data;
    await PatientRegistrationService.updateIsEditable(id, is_editable, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

/**
 * Update patient registration field enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await PatientRegistrationService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

// **** Export default **** //

export default {
    getAll,
    updateIsMandatory,
    updateIsEditable,
    updateIsEnabled
} as const;