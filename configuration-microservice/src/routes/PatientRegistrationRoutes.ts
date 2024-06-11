import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import PatientRegistrationService from '@src/services/PatientRegistrationService';
import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import FeaturesService from '@src/services/FeaturesService';

// **** Functions **** //

/**
 * Get all patient registration fields.
 */
async function getAll(_: IReq, res: IRes) {
    const pr = await PatientRegistrationService.getAll();
    const pr_address_section = await FeaturesService.getByName("patient_reg_address");
    const pr_other_section = await FeaturesService.getByName("patient_reg_other");
    return res.status(HttpStatusCodes.OK).json({ patient_registration: pr , patient_registration_address: pr_address_section, patient_registration_other: pr_other_section});
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