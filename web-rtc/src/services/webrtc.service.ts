import { WebSocketServer } from 'ws';
import { RoomServiceClient, Room, AccessToken, EgressClient, EncodedFileOutput, VideoGrant, EncodingOptionsPreset, EncodedFileType } from 'livekit-server-sdk';
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
        if (!MAIL_USERNAME || !MAIL_PASSWORD || !MAIL_ALERT_RECIPIENT) return;
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
        } catch (err) {
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

            // racing another INSERT into call_recordings.
            const existingRecording = await call_recordings.findOne({
                where: { room_id: roomName, end_time: null },
                order: [['id', 'DESC']]
            });

            if (existingRecording) {
                logStream('debug', `Recording already in progress for room ${roomName}, returning existing recording`, 'startRecording');
                return {
                    egressId: existingRecording.egress_id,
                    filePath: existingRecording.file_path,
                    recordingId: existingRecording.id,
                    startTime: existingRecording.start_time,
                    s3_url: existingRecording.s3_url,
                    success: true
                };
            }

            // Use existing egressSvc or initialize if not available
            if (!this.egressSvc) {
                logStream('debug', 'EgressClient not initialized, initializing now', 'startRecording');
                this.egressSvc = new EgressClient(LIVEHOST as string, API_KEY, SECRET);
            }

            const activeRooms = await this.egressSvc.listEgress({ roomName: roomName }).catch((err: any) => {
                logStream('warn', `listEgress failed for room ${roomName}: ${err?.message}`, 'startRecording');
                Sentry.captureException(err, { tags: { roomName } });
                return undefined;
            });

            const activeEgresses = activeRooms?.filter(
                (info: { status: number; }) => info.status < 2,
            );

            if (activeEgresses && activeEgresses.length > 0) {
                await Promise.all(activeEgresses.map((info: { egressId: any; }) => {
                    if (this.egressSvc) {
                        return this.egressSvc.stopEgress(info.egressId).catch((err: any) => {
                            logStream('debug', `stopEgress ignored for ${info.egressId}: ${err?.message}`, 'startRecording');
                            Sentry.captureException(err, { tags: { roomName }, extra: { egressId: info.egressId } });
                        });
                    }
                    return Promise.resolve();
                }));
            }
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
                encodingOptions: EncodingOptionsPreset.H264_1080P_30 // H264 video encoding preset (1080p at 30fps)
            };

            logStream('debug', `Starting egress with output: ${JSON.stringify(output)}`, 'startRecording');
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

            const activeRooms = await this.egressSvc.listEgress({ roomName });

            const activeEgresses = activeRooms?.filter(
                (info: { status: number; }) => info.status < 2,
            );

            if (activeEgresses.length === 0) {
                return {
                    status: 200,
                    message: 'No active recording found',
                    success: true
                };
            }

            const endTime = new Date();

            // Stop all active egresses
            await Promise.all(activeEgresses.map(async (info: { egressId: any; }) => {
                if (!this.egressSvc) {
                    return Promise.resolve();
                }
                await this.egressSvc.stopEgress(info.egressId).catch((err: any) => {
                    logStream('debug', `stopEgress ignored for ${info.egressId}: ${err?.message}`, 'stopRecording');
                    Sentry.captureException(err, { tags: { roomName }, extra: { egressId: info.egressId } });
                });

                // Update the recording end time in database with retry logic
                await retryWithExponentialBackoff(
                    () => call_recordings.update(
                        { end_time: endTime },
                        { where: { egress_id: info.egressId } }
                    ),
                    `Update recording end time for egress ${info.egressId}`,
                    7,
                    1000
                ).catch((err: any) => {
                    logStream('error', `Failed to update end_time for egress ${info.egressId}: ${err?.message}`, 'stopRecording');
                    Sentry.captureException(err, { tags: { roomName }, extra: { egressId: info.egressId } });
                });
            })).catch((err: any) => {
                logStream('error', `Unexpected error while stopping recordings for room ${roomName}: ${err?.message}`, 'stopRecording');
                Sentry.captureException(err, { tags: { roomName } });
            });

            return {
                activeEgresses,
                endTime,
                message: 'Recording stopped and database updated',
                success: true
            };
        } catch (err: any) {
            Sentry.captureException(err, { tags: { roomName } });
            throw new Error(err?.message ?? 'Something went wrong!')
        }
    }
}

