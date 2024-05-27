import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import WebrtcService from '@src/services/WebrtcService';

// **** Functions **** //

/**
 * Get all webrtc configs.
 */
async function getAll(_: IReq, res: IRes) {
    const webrtc = await WebrtcService.getAll();
    return res.status(HttpStatusCodes.OK).json({ webrtc });
}

/**
 * Update webrtc config enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await WebrtcService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled
} as const;