import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import ThemeConfigService from '@src/services/ThemeConfigService';
import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import { getAssetPath } from '@src/util/misc';

// **** Functions **** //

/**
 * Get all data of theme config.
 */
async function getAll(_: IReq, res: IRes) {
    const theme_config = await ThemeConfigService.getAll();
    return res.status(HttpStatusCodes.OK).json({ theme_config });
}

/**
 * Update theme config.
 */
async function updateThemeConfig(req: IReqUser<{ key: string, value: any}>, res: IRes) {
    const { key, value } = req.body;
    const { userId, name } = req.user.data;
    const themeData = await ThemeConfigService.updateThemeConfig(key, value, userId, name, req.file);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: themeData});
}

/**
 * Upload Image
 */
async function uploadImage(req: IReqUser, res: IRes) {
    const fileDetails:any = {...req.file};
    fileDetails.image_path = getAssetPath(fileDetails.path);
    return res.status(HttpStatusCodes.OK).json({ success: true, data: fileDetails});
}

/**
 * Update images & text.
 */
async function updateImagesText(req: IReqUser<{ data: { text: string, image: string}[] }>, res: IRes) {
    const { data } = req.body;
    const { userId, name } = req.user.data;
    await ThemeConfigService.updateImagesText(data, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}


/**
 * Delete image
 */
async function deleteFile(req: IReqUser<{ filePath: string }>, res: IRes) {
    const { filePath } = req.body;
    const { userId, name } = req.user.data;
    await ThemeConfigService.deleteFile(filePath);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

/**
 * Update help tour.
 */
async function updateHelpTour(req: IReqUser<{ help_tour_config: string }>, res: IRes) {
    const { help_tour_config } = req.body;
    const { userId, name } = req.user.data;
    await ThemeConfigService.updateHelpTourConfig(help_tour_config, userId, name);
    return res.status(HttpStatusCodes.OK).json({ success: true });
}

// **** Export default **** //

export default {
    getAll,
    updateThemeConfig,
    updateImagesText,
    uploadImage,
    deleteFile,
    updateHelpTour
} as const;