import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import HomeScreenService from '@src/services/HomeScreenService';

// **** Functions **** //

/**
 * Get all patient vitals.
 */
async function getAll(_: IReq, res: IRes) {
    const hss = await HomeScreenService.getAll();
    return res.status(HttpStatusCodes.OK).json({ home_screen_sections: (hss ?? [])});
}

/**
 * Update patient vital enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await HomeScreenService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

/**
 * Update patient visit section name update.
 */
async function updateHomeScreenName(req: IReqUser<{ lang: any }>, res: IRes) {
    const { id } = req.params;
    const { userId, name } = req.user.data;
    const { lang } = req.body
    await HomeScreenService.updateHomeScreenName(id, lang, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    updateHomeScreenName,
} as const;