import { Request, Response } from "express";
import { WebRTCService } from "../services/webrtc.service";
const { logStream } = require("../logger/index");

export class MainController {
    constructor(
    ) { }

    getToken(req: Request, res: Response) {
        logStream('debug', 'API calling', 'Get Token');
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

        logStream('debug', 'Success', 'Get Token');
        res.json({
            token,
            appToken,
            success: true
        });
    }

    async startRecording(req: Request, res: Response) {
        logStream('debug', 'API calling', 'Get Token');
        try {
            const roomName = req.query.roomId;
            if (!roomName) {
                res.json({ message: "Missing roomId.", success: false });
                return;
            }
            const response = await new WebRTCService().startRecording((req.query.roomId as string));
            logStream('debug', 'Success', 'Get Token');
            return res.json(response);
        } catch (error) {
            console.error("Error occurred:", error);

            if (error instanceof Error) {
                console.error("Error details:", error);
                return res.status(500).json({
                    message: error.message,
                    success: false
                });
            }

            return res.status(500).json({
                message: "An unexpected error occurred",
                success: false
            });
        }

    }

    async stopRecording(req: Request, res: Response) {
        logStream('debug', 'API calling', 'Get Token');
        try {
            const roomName = req.query.roomId;
            if (!roomName) {
                res.json({ message: "Missing roomId.", success: false });
                return;
            }
            const response = await new WebRTCService().stopRecording((req.query.roomId as string));
            if (response?.success === false) {
                return res.status(response?.status ?? 500).json(response)
            }
            logStream('debug', 'Success', 'Get Token');
            return res.json(response);
        } catch (error) {
            console.error("Error occurred:", error);

            if (error instanceof Error) {
                console.error("Error details:", error);
                return res.status(500).json({
                    message: error.message,
                    success: false
                });
            }

            return res.status(500).json({
                message: "An unexpected error occurred",
                success: false
            });
        }

    }
}
