import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import LanguageService from '@src/services/LanguageService';
import { IReq, IRes } from './types/express/misc';

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
async function updateIsEnabled(req: IReq<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    await LanguageService.updateIsEnabled(id, is_enabled);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

/**
 * Set language as default language.
 */
async function setDefault(req: IReq, res: IRes) {
    const { id } = req.params;
    await LanguageService.setDefault(id);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled,
    setDefault
} as const;