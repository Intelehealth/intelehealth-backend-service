import { NextFunction, Request, Response } from "express";
import { WebRTCService } from "../services/webrtc.service";

export class MainController {
    constructor(
    ) { }

    getToken(req: Request, res: Response, next: NextFunction) {
        if (!req.query.roomId) {
            res.json({ message: "Missing roomId.", success: false });
            return;
        }
        if (!req.query.name) {
            res.json({ message: "Missing name.", success: false });
            return;
        }
        if (!req.query.nurseName) {
            res.json({ message: "Missing nurseName.", success: false });
            return;
        }

        const token = new WebRTCService().getToken((req.query.roomId as string), (req.query.name as string));
        const appToken = new WebRTCService().getToken((req.query.roomId as string), (req.query.nurseName as string));


        res.json({
            token,
            appToken,
            success: true
        });
    }
}
