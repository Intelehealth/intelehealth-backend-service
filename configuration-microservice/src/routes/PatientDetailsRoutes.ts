import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import FeaturesService from '@src/services/FeaturesService';

// **** Functions **** //

/**
 * Get all patient visit summary sections.
 */
async function getAll(_: IReq, res: IRes) {
    const secs = ['Patient Family Member Registration','Patient Household Survey'];
    let sections = await FeaturesService.getAll();
    console.log('sections: ', sections);
    sections = sections.filter((section:any) => secs.includes(section.name));
    return res.status(HttpStatusCodes.OK).json({ patient_details_sections: sections });
}

/**
 * Update patient visit summary section enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await FeaturesService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled
} as const;