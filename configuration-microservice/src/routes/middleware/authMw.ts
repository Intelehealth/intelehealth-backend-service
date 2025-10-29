/**
 * Middleware to verify user logged in and is an an admin.
 */

import { Response, NextFunction, ExtendedRequest } from 'express';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import EnvVars from '@src/constants/EnvVars';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// **** Variables **** //

const TOKEN_MISSING = 'Invalid authorization header';
const USER_UNAUTHORIZED_ERR = 'User not authorized to perform this action';


// **** Functions **** //

/**
 * See note at beginning of file.
 */
async function authMw(
    req: ExtendedRequest,
    res: Response,
    next: NextFunction,
) {
    const authorizationHeader = req.header("Authorization");

    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        return res
            .status(HttpStatusCodes.UNAUTHORIZED)
            .json({ error: TOKEN_MISSING });
    }
    const token = authorizationHeader.replace("Bearer ", "");
    if (!token) {
        return res
            .status(HttpStatusCodes.UNAUTHORIZED)
            .json({ error: TOKEN_MISSING });
    }
    try {
        const publicKeyPath = path.join(__dirname, "../../..", EnvVars.PemFolderPath, 'public_key.pem');
        const decoded = jwt.verify(token, fs.readFileSync(publicKeyPath, { encoding: 'utf8', flag: 'r' }));
        console.log(decoded);
        req.user = decoded;
        return next();
    } catch (err) {
        return res
            .status(HttpStatusCodes.UNAUTHORIZED)
            .json({ error: USER_UNAUTHORIZED_ERR });
    }
}

// **** Export Default **** //

export default authMw;