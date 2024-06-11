import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import FeaturesService from '@src/services/FeaturesService';

// **** Functions **** //

/**
 * Get all feature configs.
 */
async function getAll(_: IReq, res: IRes) {
    const feature = await FeaturesService.getAll();
    return res.status(HttpStatusCodes.OK).json({ feature });
}

/**
 * Get all feature configs.
 */
async function getByKey(req: IReq, res: IRes) {
    const feature = await FeaturesService.getByKey(req.params.key);
    return res.status(HttpStatusCodes.OK).json({ feature });
}

/**
 * Update feature config enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await FeaturesService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

// **** Export default **** //

export default {
    getAll,
    getByKey,
    updateIsEnabled
} as const;