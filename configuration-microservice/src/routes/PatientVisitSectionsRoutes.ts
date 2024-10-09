import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import PatientVisitSectionService from '@src/services/PatientVisitSectionService';

// **** Functions **** //

/**
 * Get all patient vitals.
 */
async function getAll(_: IReq, res: IRes) {
    const pvs = await PatientVisitSectionService.getAll();
    return res.status(HttpStatusCodes.OK).json({ patient_visit_sections: pvs});
}

/**
 * Update patient vital enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await PatientVisitSectionService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

/**
 * Update patient visit section name update.
 */
async function updateName(req: IReqUser<{ name: any }>, res: IRes) {
    const { id } = req.params;
    const { userId, name } = req.user.data;
    const { name: langNames } = req.body
    await PatientVisitSectionService.updateName(id, langNames, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}


/**
 * Update patient visit section order updated.
 */
async function updateOrder(req: IReqUser<{ order:any }>, res: IRes) {
    const { userId, name } = req.user.data;
    const { order } = req.body
    await PatientVisitSectionService.updateOrder(order, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}


// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateName,
    updateOrder,
} as const;