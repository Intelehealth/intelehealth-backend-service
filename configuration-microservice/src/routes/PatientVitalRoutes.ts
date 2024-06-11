import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import VitalService from '@src/services/PatientVitalService';
import FeaturesService from '@src/services/FeaturesService';
import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';

// **** Functions **** //

/**
 * Get all patient vitals.
 */
async function getAll(_: IReq, res: IRes) {
    const vitals = await VitalService.getAll();
    const vital_section = await FeaturesService.getByKey("patient_vitals_section");
    return res.status(HttpStatusCodes.OK).json({ patient_vitals: vitals, patient_vitals_section: vital_section});
}

/**
 * Update patient vital enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await VitalService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

/**
 * Update patient vital mandatory status.
 */
async function updateIsMandatory(req: IReqUser<{ is_mandatory: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_mandatory } = req.body;
    const { userId, name } = req.user.data;
    await VitalService.updateIsMandatory(id, is_mandatory, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateIsMandatory,
} as const;