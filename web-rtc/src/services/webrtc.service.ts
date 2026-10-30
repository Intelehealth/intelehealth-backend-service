import { WebSocketServer } from 'ws';
import { RoomServiceClient, Room, AccessToken, EgressClient, EncodedFileOutput, VideoGrant, EncodingOptionsPreset, EncodedFileType, EgressInfo, EgressStatus } from 'livekit-server-sdk';
import moment from 'moment';
import nodemailer from 'nodemailer';
import * as Sentry from '@sentry/node';
const { logStream } = require("../logger/index");
const { call_recordings } = require("../models");

/**
 * Retry helper function with exponential backoff for database operations
 * Handles transient failures like lock timeouts and deadlocks
 */
async function retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 7,
    baseBackoff: number = 1000
): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (err: any) {
            lastError = err;
            const isTransientError = /Lock wait timeout|Deadlock detected|ECONNREFUSED|ETIMEDOUT|pool is destroyed|connection terminated/i.test(err.message || '');
            
            if (!isTransientError || attempt === maxRetries) {
                throw err;
            }
            
            // Calculate exponential backoff with jitter
            const exponentialDelay = baseBackoff * Math.pow(1.5, attempt);
            const jitter = Math.random() * 0.1 * exponentialDelay; // 0-10% jitter
            const delayMs = exponentialDelay + jitter;
            
            logStream('warn', `${operationName} failed with transient error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${Math.round(delayMs)}ms. Error: ${err.message}`, 'retryWithExponentialBackoff');
            
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    throw lastError || new Error(`${operationName} failed after maximum retries`);
}

async function sendRecordingFailureAlert({
    roomName,
    visitId,
    doctorId,
    patientId,
    error
}: {
    roomName?: string;
    visitId?: string;
    doctorId?: string;
    patientId?: string;
    error: string;
}) {
    try {
        const {
            MAIL_USERNAME,
            MAIL_PASSWORD,
            MAIL_ALERT_RECIPIENT
        } = process.env;
        if (!MAIL_USERNAME || !MAIL_PASSWORD || !MAIL_ALERT_RECIPIENT) {
            logStream('error', `Recording failure alert not sent, MAIL_USERNAME/MAIL_PASSWORD/MAIL_ALERT_RECIPIENT not configured. Room: ${roomName || '-'}, visit: ${visitId || '-'}`, 'sendRecordingFailureAlert');
            return;
        }
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: MAIL_USERNAME,
                pass: MAIL_PASSWORD
            }
        });
        const mailOptions = {
            from: MAIL_USERNAME,
            to: MAIL_ALERT_RECIPIENT,
            subject: `ALERT: WebRTC Recording Failed - Room: ${roomName || ''}`,
            html: `<b>WebRTC Recording Failure Detected</b><br>
                Room: ${roomName || '-'}<br>
                Visit ID: ${visitId || '-'}<br>
                Doctor ID: ${doctorId || '-'}<br>
                Patient ID: ${patientId || '-'}<br>
                Error: <pre>${error}</pre><br>
                Detected at: ${new Date().toISOString()}`
            };
        await transporter.sendMail(mailOptions);
    } catch (e) {
        // logging only
        logStream('error', 'Failed to send recording failure alert: ' + (e as Error).message, 'sendRecordingFailureAlert');
        Sentry.captureException(e);
    }
}

export class WebRTCService {
    wss: WebSocketServer | null = null;
    liveSvc: any;
    egressSvc: EgressClient | null = null;

    constructor() {
        // this.initLiveSvc()
    }

    startWebSocketServer({
        server,
        onConnection,
        onWebSocketMessage,
        onWebSocketError
    }: any) {
        logStream('debug', 'API calling', 'Start Web Socket Server');
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws) => {
            ws.on('error', onWebSocketError);

            ws.on('message', onWebSocketMessage);

            ws.send('Connected.');

            onConnection(ws);
        })
        logStream('debug', `The WebSocket server is running on port ${process.env.PORT}`, 'Start Web Socket Server');
    }

    initLiveSvc() {
        const {
            API_KEY,
            SECRET,
            LIVEHOST
        } = process.env;
        this.liveSvc = new RoomServiceClient(LIVEHOST as string, API_KEY, SECRET);
        return this.liveSvc;
    }


    async getToken(roomName: string, participantName: string, opts = {}, ttl: string | number = '10 days') {
        try {
            let options: VideoGrant = {
                recorder: true,
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
                roomRecord: true
            };

            options = { ...options, ...opts };

            const at = new AccessToken(process.env.API_KEY, process.env.SECRET, {
                identity: participantName,
                ttl,
            });
            at.addGrant(options);

            return await at.toJwt();
        } catch (err: any) {
            logStream('error', `Failed to generate token: ${err?.message}`, 'getToken');
            Sentry.captureException(err, { tags: { roomName } });
            throw err;
        }
    }

    getGuestToken(roomName: string, participantName: string, ttlSeconds: number) {
        return this.getToken(
            roomName,
            participantName,
            {
                recorder: false,
                roomRecord: false,
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
            },
            Math.max(60, Math.floor(ttlSeconds))
        );
    }

    async listParticipants(roomName: string) {
        const raw = process.env.LIVEKIT_ROOM_HOST || process.env.LIVEHOST || '';
        const host = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
        try {
            const svc = new RoomServiceClient(host, process.env.API_KEY, process.env.SECRET);
            return await svc.listParticipants(roomName);
        } catch (err: any) {
            logStream('error', `Failed to list participants for room ${roomName}: ${err?.message}`, 'listParticipants');
            Sentry.captureException(err, { tags: { roomName } });
            return [];
        }
    }

    getRoomList() {

        // list rooms
        this.liveSvc.listRooms().then((rooms: Room[]) => {
            console.log('existing rooms', rooms);
        }).catch((err: any) => {
            logStream('error', `Failed to list rooms: ${err?.message}`, 'getRoomList');
            Sentry.captureException(err);
        });

        // create a new room
        // const opts = {
        //     name: 'myroom',
        //     // timeout in seconds
        //     emptyTimeout: 10 * 60,
        //     maxParticipants: 20,
        // };
        // this.liveSvc.createRoom(opts).then((room: Room) => {
        //     console.log('room created', room);
        // });

        // // delete a room
        // this.liveSvc.deleteRoom('myroom').then(() => {
        //     console.log('room deleted');
        // });
    }

    async startRecording(roomName: string, params?: {
        roomId?: string;
        doctorId?: string;
        patientId?: string;
        visitId?: string;
        chwId?: string;
        nurseName?: string;
        location?: string;
        callType?: string;
    }) {
        try {
            const {
                API_KEY,
                SECRET,
                LIVEHOST,
                AWS_ACCESS_KEY_ID,
                AWS_SECRET_ACCESS_KEY,
                AWS_REGION,
                S3_BUCKET_NAME,
                BRANDNAME,
                DOMAIN
            } = process.env;

            // Log environment check
            logStream('debug', 'Checking environment variables', 'startRecording');

            // Validate environment variables
            if (!API_KEY || !SECRET || !LIVEHOST) {
                const error = 'Missing required environment variables (API_KEY, SECRET, or LIVEHOST)';
                logStream('error', error, 'startRecording');
                throw new Error(error);
            }

            if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !S3_BUCKET_NAME) {
                const error = 'Missing required AWS environment variables';
                logStream('error', error, 'startRecording');
                throw new Error(error);
            }

            // Use existing egressSvc or initialize if not available
            if (!this.egressSvc) {
                logStream('debug', 'EgressClient not initialized, initializing now', 'startRecording');
                this.egressSvc = new EgressClient(LIVEHOST as string, API_KEY, SECRET);
            }

            const activeRooms = await this.egressSvc.listEgress({ roomName: roomName }).catch((err: any) => {
                logStream('error', `listEgress failed for room ${roomName}, starting a new recording without checking for a live one: ${err?.message}`, 'startRecording');
                Sentry.captureException(err, { tags: { roomName } });
                return undefined;
            });

            const activeEgresses = activeRooms?.filter(
                (info: { status: number; }) => info.status < EgressStatus.EGRESS_ENDING,
            );

            const openRecordings = await call_recordings.findAll({
                where: { room_id: roomName, end_time: null },
                order: [['id', 'DESC']]
            });

            const liveRecording = openRecordings.find((rec: any) =>
                rec.visit_id === params?.visitId &&
                activeEgresses?.some((info) => info.egressId === rec.egress_id)
            );

            if (liveRecording) {
                logStream('info', `Recording egress ${liveRecording.egress_id} already active for room ${roomName}, visit ${params?.visitId}`, 'startRecording');
                return {
                    egressId: liveRecording.egress_id,
                    filePath: liveRecording.file_path,
                    recordingId: liveRecording.id,
                    startTime: liveRecording.start_time,
                    s3_url: liveRecording.s3_url,
                    success: true
                };
            }

            const stoppedEgressIds = new Set<string>();
            if (activeEgresses && activeEgresses.length > 0) {
                await Promise.all(activeEgresses.map(async (info) => {
                    try {
                        await this.egressSvc!.stopEgress(info.egressId);
                        stoppedEgressIds.add(info.egressId);
                    } catch (err: any) {
                        logStream('error', `Failed to stop leftover egress ${info.egressId} in room ${roomName}: ${err?.message}`, 'startRecording');
                        Sentry.captureException(err, { tags: { roomName }, extra: { egressId: info.egressId } });
                    }
                }));
            }

            await this.closeOpenRecordings(openRecordings, activeRooms, stoppedEgressIds, roomName, 'startRecording');
            const strlocation = (params?.location) ? (params.location) : "Other";
            const strVisitId = (params?.visitId) ? (params.visitId) : "unknown-visit";
            const timestamp = new Date();
            const formattedTime = moment().format('DD-MM-YYYY_HH:mm:ss');
            const filePath = `${BRANDNAME}/${DOMAIN}/${strlocation}/recording-${strVisitId}-${formattedTime}.mp4`;
            console.log('filePath:', filePath);
            const output = {
                file: new EncodedFileOutput({
                    fileType: EncodedFileType.MP4,
                    filepath: filePath,
                    output: {
                        case: "s3",
                        value: {
                            bucket: process.env.S3_BUCKET_NAME,
                            region: process.env.AWS_REGION,
                            accessKey: process.env.AWS_ACCESS_KEY_ID,
                            secret: process.env.AWS_SECRET_ACCESS_KEY,
                            metadata: {
                                roomName,
                                timestamp: timestamp.toISOString(),
                                doctorId: params?.doctorId || '',
                                patientId: params?.patientId || '',
                                visitId: params?.visitId || ''
                            }
                        }
                    }
                }),
            }

            const options = {
                layout: 'grid',  // Layout for video streams (e.g., grid, speaker, etc.)
                encodingOptions: EncodingOptionsPreset.H264_1080P_30, // H264 video encoding preset (1080p at 30fps)
                audioOnly: params?.callType === 'audio' // Audio calls: record the audio only, still as .mp4
            };

            // Never log `output` itself: it carries the S3 access key and secret.
            logStream('debug', `Starting egress for room ${roomName} to s3://${S3_BUCKET_NAME}/${filePath}`, 'startRecording');
            logStream('debug', `Starting egress with options: ${JSON.stringify(options)}`, 'startRecording');

            const startEgressResponse = await this.egressSvc.startRoomCompositeEgress(roomName, output, options)


            if (!startEgressResponse?.egressId) {
                const error = 'Recording not started - No egress ID received';
                logStream('error', error, 'startRecording');
                throw new Error(error);
            }

            logStream('debug', `Recording started successfully with egressId: ${startEgressResponse.egressId}`, 'startRecording');

            // Construct the S3 URL from the filepath we requested (see note above)
            const fileName = startEgressResponse?.fileResults?.[0]?.filename;
            const s3Url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${filePath}`;

            // Store recording in call_recordings table with all required fields
            const recordingData = {
                room_id: params?.roomId,
                doctor_id: params?.doctorId,
                patient_id: params?.patientId,
                visit_id: params?.visitId,
                chw_id: params?.chwId,
                egress_id: startEgressResponse.egressId,
                file_path: filePath,
                s3_url: s3Url,
                start_time: timestamp,
                end_time: null,
                nurse_name: params?.nurseName
            };

            // Use retry helper for database operation with exponential backoff
            const recording = await retryWithExponentialBackoff<any>(
                () => call_recordings.create(recordingData),
                `Create recording for visit ${params?.visitId}`,
                7,
                1000
            );
            
            return {
                egressId: startEgressResponse.egressId,
                filePath: filePath,
                recordingId: recording.id,
                startTime: timestamp,
                s3_url: s3Url,
                success: true
            };
        } catch (err: any) {
            logStream('error', `Recording error: ${err.message}${err.stack ? '\n' + err.stack : ''}`, 'startRecording');
            Sentry.captureException(err, { tags: { roomName }, extra: { visitId: params?.visitId, doctorId: params?.doctorId, patientId: params?.patientId } });
            await sendRecordingFailureAlert({
                roomName,
                visitId: params?.visitId,
                doctorId: params?.doctorId,
                patientId: params?.patientId,
                error: err?.stack || err?.message || String(err)
            });
            throw new Error(err?.message ?? 'Something went wrong.');
        }
    }

    async stopRecording(roomName: string) {
        try {
            const {
                API_KEY,
                SECRET,
                LIVEHOST
            } = process.env;

            // Use existing egressSvc or initialize if not available
            if (!this.egressSvc) {
                logStream('debug', 'EgressClient not initialized, initializing now', 'stopRecording');
                this.egressSvc = new EgressClient(LIVEHOST as string, API_KEY, SECRET);
            }

            const roomEgresses = await this.egressSvc.listEgress({ roomName });

            const activeEgresses = roomEgresses.filter(
                (info: { status: number; }) => info.status < EgressStatus.EGRESS_ENDING,
            );

            // Stop all active egresses
            const stoppedEgressIds = new Set<string>();
            const stopFailures: string[] = [];
            await Promise.all(activeEgresses.map(async (info) => {
                try {
                    await this.egressSvc!.stopEgress(info.egressId);
                    stoppedEgressIds.add(info.egressId);
                } catch (err: any) {
                    logStream('error', `Failed to stop egress ${info.egressId} in room ${roomName}: ${err?.message}`, 'stopRecording');
                    Sentry.captureException(err, { tags: { roomName }, extra: { egressId: info.egressId } });
                    stopFailures.push(`${info.egressId}: ${err?.message}`);
                }
            }));

            // Close every open row of the room, including ones whose egress LiveKit already
            // ended (room emptied, egress failed) before this request arrived.
            const openRecordings = await call_recordings.findAll({
                where: { room_id: roomName, end_time: null }
            });
            const closeFailures = await this.closeOpenRecordings(openRecordings, roomEgresses, stoppedEgressIds, roomName, 'stopRecording');

            if (stopFailures.length > 0 || closeFailures.length > 0) {
                const error = `Recording stop incomplete for room ${roomName}. Stop failures: [${stopFailures.join('; ')}]. Row update failures: [${closeFailures.join('; ')}]`;
                await sendRecordingFailureAlert({ roomName, error });
                return {
                    status: 500,
                    message: error,
                    success: false
                };
            }

            if (activeEgresses.length === 0) {
                return {
                    status: 200,
                    message: 'No active recording found',
                    success: true
                };
            }

            return {
                activeEgresses,
                message: 'Recording stopped and database updated',
                success: true
            };
        } catch (err: any) {
            logStream('error', `Failed to stop recording for room ${roomName}: ${err?.message}`, 'stopRecording');
            Sentry.captureException(err, { tags: { roomName } });
            throw new Error(err?.message ?? 'Something went wrong!')
        }
    }

    async reportClientRecordingError(params: {
        action: string;
        roomId?: string;
        visitId?: string;
        doctorId?: string;
        patientId?: string;
        recordingId?: string | number;
        error?: string;
    }) {
        const error = `Doctor webapp reported ${params.action} failure (recording ${params.recordingId ?? '-'}): ${String(params.error ?? 'no detail').slice(0, 2000)}`;
        logStream('error', `${error}. Room: ${params.roomId || '-'}, visit: ${params.visitId || '-'}`, 'reportClientRecordingError');
        Sentry.captureMessage(error, {
            level: 'error',
            tags: { roomName: params.roomId },
            extra: { visitId: params.visitId, doctorId: params.doctorId, patientId: params.patientId }
        });
        await sendRecordingFailureAlert({
            roomName: params.roomId,
            visitId: params.visitId,
            doctorId: params.doctorId,
            patientId: params.patientId,
            error
        });
    }

    /**
     * Sets end_time on open call_recordings rows whose egress is known to be over: either
     * stopped by this request, or reported ended by LiveKit. Rows with no confirmed end are
     * left open. Failed or empty egresses are reported, since nothing else surfaces them.
     * Returns the rows that could not be updated.
     */
    private async closeOpenRecordings(
        openRecordings: any[],
        roomEgresses: EgressInfo[] | undefined,
        stoppedEgressIds: Set<string>,
        roomName: string,
        caller: string
    ): Promise<string[]> {
        const failures: string[] = [];
        for (const recording of openRecordings) {
            const info = roomEgresses?.find((egress) => egress.egressId === recording.egress_id);
            let endTime: Date | null = null;
            if (stoppedEgressIds.has(recording.egress_id)) {
                endTime = new Date();
            } else if (info && info.endedAt > BigInt(0)) {
                endTime = new Date(Number(info.endedAt / BigInt(1000000)));
            }

            if (!endTime) {
                logStream('warn', `Recording ${recording.id} (egress ${recording.egress_id}, visit ${recording.visit_id}) has no confirmed end in LiveKit; leaving it open`, caller);
                continue;
            }

            if (info) {
                await reportEgressOutcome(info, recording, roomName, caller);
            }

            try {
                await retryWithExponentialBackoff(
                    () => call_recordings.update(
                        { end_time: endTime },
                        { where: { id: recording.id } }
                    ),
                    `Update recording end time for egress ${recording.egress_id}`,
                    7,
                    1000
                );
            } catch (err: any) {
                logStream('error', `Failed to update end_time for recording ${recording.id} (egress ${recording.egress_id}): ${err?.message}`, caller);
                Sentry.captureException(err, { tags: { roomName }, extra: { recordingId: recording.id, egressId: recording.egress_id } });
                failures.push(`${recording.egress_id}: ${err?.message}`);
            }
        }
        return failures;
    }
}

const FAILED_EGRESS_STATUSES = [
    EgressStatus.EGRESS_FAILED,
    EgressStatus.EGRESS_ABORTED,
    EgressStatus.EGRESS_LIMIT_REACHED
];

/**
 * Logs and alerts when LiveKit reports that an egress failed or completed with an empty file.
 */
async function reportEgressOutcome(info: EgressInfo, recording: any, roomName: string, caller: string) {
    const emptyFile = info.status === EgressStatus.EGRESS_COMPLETE &&
        info.fileResults.length > 0 &&
        info.fileResults.every((file) => file.size === BigInt(0));
    if (!FAILED_EGRESS_STATUSES.includes(info.status) && !emptyFile) return;

    const error = `Egress ${info.egressId} for recording ${recording.id} ended with status ${EgressStatus[info.status]}` +
        `${emptyFile ? ' and an empty file' : ''}: ${info.error || 'no error reported'}`;
    logStream('error', error, caller);
    Sentry.captureMessage(error, { level: 'error', tags: { roomName }, extra: { recordingId: recording.id, visitId: recording.visit_id } });
    await sendRecordingFailureAlert({
        roomName,
        visitId: recording.visit_id,
        doctorId: recording.doctor_id,
        patientId: recording.patient_id,
        error
    });
}

