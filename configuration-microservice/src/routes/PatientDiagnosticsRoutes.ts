import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import DiagnosticService from '@src/services/PatientDiagnosticService';
import FeaturesService from '@src/services/FeaturesService';
import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';

// **** Functions **** //

/**
 * Get all patient diagnostics.
 */
async function getAll(_: IReq, res: IRes) {
    const diagnostics = await DiagnosticService.getAll();
    const vital_section = await FeaturesService.getByKey("patient_diagnostics_section");
    return res.status(HttpStatusCodes.OK).json({ patient_diagnostics: diagnostics, patient_diagnostics_section: vital_section});
}

/**
 * Update patient vital enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await DiagnosticService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

/**
 * Update patient vital mandatory status.
 */
async function updateIsMandatory(req: IReqUser<{ is_mandatory: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_mandatory } = req.body;
    const { userId, name } = req.user.data;
    await DiagnosticService.updateIsMandatory(id, is_mandatory, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateIsMandatory,
} as const;