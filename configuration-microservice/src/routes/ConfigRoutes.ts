import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import ConfigService from '@src/services/ConfigService';
import { IReq, IRes } from './types/express/misc';
// import tmp from 'tmp';
import fs from 'fs';
import path from 'path';
import { RouteError } from '@src/other/classes';
import { IReqUser } from './types/types';

// **** Variables **** //

export const NOTHING_TO_PUBLISH = 'There are no any changes to publish';
export const NOTHING_PUBLISHED = 'There are no any published config';

// **** Functions **** //

/**
 * Get all config.
 */
async function getConfig(_: IReq, res: IRes) {
    const config = await ConfigService.getAll();
    const data: any = {};
    for (const item of config) {
        const key = item.key;
        data[key] = parseValue(item.type, item.value)
    }
    return res.status(HttpStatusCodes.OK).json(data);
}

/**
 * Get latest config.
 */
async function getPublishedConfig(_: IReq, res: IRes) {
    const config = await ConfigService.getPublishedConfig();
    if (!config) {
        throw new RouteError(
            HttpStatusCodes.BAD_REQUEST,
            NOTHING_PUBLISHED,
        );
    }
    const fileContent = JSON.parse(fs.readFileSync(config.path, { encoding: 'utf-8' }));
    return res.status(HttpStatusCodes.OK).json(fileContent);
}

/**
 * Publish config.
 */
async function publish(req: IReqUser, res: IRes) {
    const { userId, name } = req.user.data;
    const config = await ConfigService.getAll();
    const data: any = {};
    let flag = 0;
    for (const item of config) {
        const key = item.key;
        data[key] = parseValue(item.type, item.value);
        if (!item.published) flag = 1;
    }

    if (flag == 0) {
        throw new RouteError(
            HttpStatusCodes.BAD_REQUEST,
            NOTHING_TO_PUBLISH,
        );
    }
    const version = await ConfigService.getMaxIdPublish() ?? 0;
    data['version'] = version + 1;
    // const tmpObj = tmp.dirSync({
    //     dir: path.join(__dirname, `publish-config`)
    // });
    // const tmpDir = tmpObj.name;
    const tmpDir = path.join(__dirname, '../public/configs');
    const outputFilename = `config-${new Date().valueOf()}`;
    const outputFileExtension = `json`;
    const outputFileDir = `${tmpDir}/${outputFilename}.${outputFileExtension}`;
    fs.writeFileSync(outputFileDir, JSON.stringify(data));
    await ConfigService.publish(`${outputFilename}.${outputFileExtension}`, outputFileDir, userId, name, version + 1);
    return res.status(HttpStatusCodes.OK).json({success: true});
}

function parseValue(type:string, value: string) {
    let val: any;
    switch (type) {
        case 'array':
            val = JSON.parse(value);
            break;
        case 'json':
            val = JSON.parse(value);
            break;
        case 'number':
            val = Number(value)
            break;
        case 'string':
            val = value;
            break;
        case 'boolean':
            if(!Number.isNaN(Number(value))) {
                val = !!Number(value)
            } else {
                val = value === 'true'
            }
            break;
        default:
            break;
    }
    return val;
}

// **** Export default **** //

export default {
    getConfig,
    getPublishedConfig,
    publish
} as const;