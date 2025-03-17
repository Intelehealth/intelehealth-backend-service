import { WebSocketServer } from 'ws';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { RoomServiceClient, Room, AccessToken, EgressClient, EncodedFileOutput, VideoGrant, EncodingOptionsPreset, EncodedFileType } from 'livekit-server-sdk';
const { logStream } = require("../logger/index");
const { call_recordings } = require("../models");

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


    getToken(roomName: string, participantName: string, opts = {}) {
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
            ttl: '10 days',
        });
        at.addGrant(options);

        return at.toJwt();
    }

    getRoomList() {

        // list rooms
        this.liveSvc.listRooms().then((rooms: Room[]) => {
            console.log('existing rooms', rooms);
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

    /**
     * Gets the duration of a video from its URL and updates the database
     * @param {string} url - URL of the video
     * @param {string} egressId - ID of the recording in database
     * @returns {Promise<number>} - Duration in seconds
     */
    async getVideoDurationAndUpdate(url: string, egressId: string): Promise<number | null> {
        try {
            const duration = await getVideoDurationInSeconds(url);
            const durationInSeconds = Math.round(duration * 100) / 100; // Round to 2 decimal places

            // Update the recording with the duration
            await call_recordings.update(
                { duration: durationInSeconds },
                { where: { id: egressId } }
            );

            return durationInSeconds;
        } catch (error) {
            console.error('Error getting video duration:', error);
            return null;
        }
    }


    async startRecording(roomName: string, params?: {
        roomId?: string;
        doctorId?: string;
        patientId?: string;
        visitId?: string;
        chwId?: string;
        nurseName?: string;
    }) {
        try {
            const {
                API_KEY,
                SECRET,
                LIVEHOST,
                AWS_ACCESS_KEY_ID,
                AWS_SECRET_ACCESS_KEY,
                AWS_REGION,
                S3_BUCKET_NAME
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

            const activeRooms = await this.egressSvc.listEgress({ roomName: roomName }).catch(() => { });

            const activeEgresses = activeRooms?.filter(
                (info: { status: number; }) => info.status < 2,
            );

            if (activeEgresses && activeEgresses.length > 0) {
                await Promise.all(activeEgresses.map((info: { egressId: any; }) => {
                    if (this.egressSvc) {
                        return this.egressSvc.stopEgress(info.egressId);
                    }
                    return Promise.resolve();
                })).catch(() => { });
            }

            const timestamp = new Date();
            const output = {
                file: new EncodedFileOutput({
                    fileType: EncodedFileType.MP4,
                    filepath: '{room_name}-{time}',
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

            // Construct the S3 URL
            const s3Url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileName}`;
            const fileName = startEgressResponse?.fileResults?.[0]?.filename;
            // Store recording in call_recordings table with all required fields
            const recordingData = {
                room_id: params?.roomId,
                doctor_id: params?.doctorId,
                patient_id: params?.patientId,
                visit_id: params?.visitId,
                chw_id: params?.chwId,
                egress_id: startEgressResponse.egressId,
                file_path: fileName,
                s3_url: s3Url,
                duration: null,
                start_time: timestamp,
                end_time: null,
                nurse_name: params?.nurseName
            };

            const recording = await call_recordings.create(recordingData);
            return {
                egressId: startEgressResponse.egressId,
                filePath: fileName,
                recordingId: recording.id,
                startTime: timestamp,
                s3_url: s3Url,
                success: true
            };
        } catch (err: any) {
            logStream('error', `Recording error: ${err.message}${err.stack ? '\n' + err.stack : ''}`, 'startRecording');
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
                this.egressSvc.stopEgress(info.egressId);

                // Update the recording end time in database
                await call_recordings.update(
                    { end_time: endTime },
                    { where: { egress_id: info.egressId } }
                );
            })).catch(() => { });

            return {
                activeEgresses,
                endTime,
                message: 'Recording stopped and database updated',
                success: true
            };
        } catch (err: any) {
            console.log('error', `Stop recording error: ${err.message}`, 'stopRecording');
            throw new Error(err?.message ?? 'Something went wrong!')
        }
    }
}

