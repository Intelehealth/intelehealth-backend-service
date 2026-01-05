import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import PatientVisitSummaryService from '@src/services/PatientVisitSummaryService';
import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';

// **** Functions **** //

/**
 * Get all patient visit summary sections.
 */
async function getAll(_: IReq, res: IRes) {
    const sections = await PatientVisitSummaryService.getAll();
    const [results, metadata] = await PatientVisitSummaryService.getPriorityVisitCount();
    const priority_visit_count = results.filter((item: any) => item.status == 'Priority').length;
    const data = sections.map((s: any) => {
        if (s.name === 'Priority Visit Section') {
            s.priority_visit_count = priority_visit_count;
        }
        return s;
    });
    return res.status(HttpStatusCodes.OK).json({ patient_visit_summary: data });
}

/**
 * Update patient visit summary section enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await PatientVisitSummaryService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled
} as const;