import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import SpecializationService from '@src/services/SpecializationService';
import { IReq, IRes } from './types/express/misc';

// **** Functions **** //

/**
 * Get all specializations.
 */
async function getAll(_: IReq, res: IRes) {
    const specializations = await SpecializationService.getAll();
    const doctor_count = await SpecializationService.getSpecialityWiseDoctorCount();
    const data = [];
    for (const item of specializations) {
        const count = doctor_count.find(d => d.specialization == item.name)?.count || 0;
        data.push({ ...item, doctor_count: count });
    }
    return res.status(HttpStatusCodes.OK).json({ specializations: data });
}

/**
 * Update specialization enabled status.
 */
async function updateIsEnabled(req: IReq<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    await SpecializationService.updateIsEnabled(id, is_enabled);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled
} as const;