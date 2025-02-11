import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import DropdownService from '@src/services/DropdownService';

// **** Functions **** //

/**
 * Get all dropdown configs.
 */
async function getAll(_: IReq, res: IRes) {
    const dropdown = await DropdownService.getAll();
    return res.status(HttpStatusCodes.OK).json({ dropdown });
}

/**
 * Update dropdown config enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await DropdownService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled
} as const;