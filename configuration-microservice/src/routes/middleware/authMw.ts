/**
 * Middleware to verify user logged in and is an an admin.
 */

import { Request, Response, NextFunction, ExtendedRequest } from 'express';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
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
        const decoded = jwt.verify(token, fs.readFileSync(path.join(__dirname, '../../', '.pem', 'public_key.pem'),
            { encoding: 'utf8', flag: 'r' }
        ));
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