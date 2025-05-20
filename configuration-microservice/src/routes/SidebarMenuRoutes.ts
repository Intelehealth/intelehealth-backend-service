import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import SidebarMenuService from '@src/services/SidebarMenuService';

// **** Functions **** //

/**
 * Get all sidebar menu sections.
 */
async function getAll(_: IReq, res: IRes) {
    const sections = await SidebarMenuService.getAll();
    return res.status(HttpStatusCodes.OK).json({ sidebar_menus: sections });
}

/**
 * Update sidebar menu enabled status.
 */
async function updateIsEnabled(req: IReqUser<{ is_enabled: boolean }>, res: IRes) {
    const { id } = req.params;
    const { is_enabled } = req.body;
    const { userId, name } = req.user.data;
    await SidebarMenuService.updateIsEnabled(id, is_enabled, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

// **** Export default **** //

export default {
    getAll,
    updateIsEnabled
} as const;