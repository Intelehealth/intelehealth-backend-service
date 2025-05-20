import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import LanguageService from '@src/services/LanguageService';
import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';

// **** Functions **** //

/**
 * Get all languages.
 */
async function getAll(_: IReq, res: IRes) {
    const languages = await LanguageService.getAll();
    return res.status(HttpStatusCodes.OK).json({ languages });
}

/**
 * Update language enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await LanguageService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

/**
 * Set language as default language.
 */
async function setDefault(req: IReqUser, res: IRes) {
    const { id } = req.params;
    const { userId, name } = req.user.data;
    await LanguageService.setDefault(id, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    setDefault
} as const;