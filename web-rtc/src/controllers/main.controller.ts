import { Request, Response } from "express";
import { WebRTCService } from "../services/webrtc.service";
import { notifyCallConnected, notifyCallDisconnected } from "../services/qms.service";
const { logStream } = require("../logger/index");

export class MainController {
    constructor(
    ) { }

    async getToken(req: Request, res: Response) {
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

        const token = await new WebRTCService().getToken((req.query.roomId as string), (req.query.name as string));
        const appToken = await new WebRTCService().getToken((req.query.roomId as string), (req.query.nurseName as string));

        logStream('debug', 'Success', 'Get Token');
        res.json({
            token,
            appToken,
            success: true
        });
    }

    async startRecording(req: Request, res: Response) {
        logStream('debug', 'API calling', 'Start Recording');
        try {
            if (!req.body.roomId) {
                return res.json({ message: "Missing roomId.", success: false });
            }
            if (!req.body.doctorId) {
                return res.json({ message: "Missing doctorId.", success: false });
            }
            if (!req.body.patientId) {
                return res.json({ message: "Missing patientId.", success: false });
            }
            if (!req.body.visitId) {
                return res.json({ message: "Missing visitId.", success: false });
            }
            if (!req.body.chwId) {
                return res.json({ message: "Missing chwId.", success: false });
            }

            const recordingParams = {
                roomId: req.body.roomId,
                doctorId: req.body.doctorId,
                patientId: req.body.patientId,
                visitId: req.body.visitId,
                chwId: req.body.chwId,
                nurseName: req.body.nurseName,
                location: req.body.location,
                callType: req.body.callType
            };

            const response = await new WebRTCService().startRecording(req.body.roomId as string, recordingParams);

            // Tell QMS the call has started. Inert unless qms_section is on, and
            // deliberately NOT awaited into the response path: a queue update
            // must never delay or fail the recording that just succeeded.
            notifyCallConnected({
                visitId: req.body.visitId,
                roomId: req.body.roomId,
                doctorId: req.body.doctorId,
                authorization: req.header("Authorization") ?? null,
            }).catch(() => { /* qms.service already logged it */ });

            logStream('debug', 'Success', 'Start Recording');
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
        logStream('debug', 'API calling', 'Stop Recording');
        try {
            if (!req.query.roomId) {
                return res.json({ message: "Missing roomId.", success: false });
            }
            const response = await new WebRTCService().stopRecording((req.query.roomId as string));
            if (response?.success === false) {
                return res.status(response?.status ?? 500).json(response)
            }

            // Tell QMS the call has ended. The visit is recovered from the room
            // via call_recordings. Fire-and-forget, same reasoning as above.
            notifyCallDisconnected({
                roomId: req.query.roomId as string,
                reason: 'RECORDING_STOPPED',
                authorization: req.header("Authorization") ?? null,
            }).catch(() => { /* qms.service already logged it */ });

            logStream('debug', 'Success', 'Stop Recording');
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

    /**
     * Records a recording start/stop failure seen by the doctor webapp, so failures that never
     * reached startRecording/stopRecording (network, browser) are not only in Google Analytics.
     */
    async reportRecordingError(req: Request, res: Response) {
        logStream('debug', 'API calling', 'Report Recording Error');
        if (!req.body?.action) {
            return res.status(400).json({ message: "Missing action.", success: false });
        }
        await new WebRTCService().reportClientRecordingError({
            action: String(req.body.action),
            roomId: req.body.roomId,
            visitId: req.body.visitId,
            doctorId: req.body.doctorId,
            patientId: req.body.patientId,
            recordingId: req.body.recordingId,
            error: req.body.error
        });
        return res.json({ success: true });
    }
}
