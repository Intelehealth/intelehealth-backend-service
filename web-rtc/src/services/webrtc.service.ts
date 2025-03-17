import { WebSocketServer } from 'ws';
import { RoomServiceClient, Room, AccessToken, EgressClient } from 'livekit-server-sdk';
import AWS from 'aws-sdk';
// import * as path from 'path';
import { getVideoDurationInSeconds } from 'get-video-duration';
const { logStream } = require("../logger/index");
const { call_recordings } = require("../models");

export class WebRTCService {
    wss: WebSocketServer | null = null;
    liveSvc: any;
    egressSvc: any;

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
        let options = { roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, exp: '10 days', roomRecord: true };

        options = { ...options, ...opts };

        const at = new AccessToken(process.env.API_KEY, process.env.SECRET, {
            identity: participantName,
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

            const activeRooms = await this.egressSvc.listEgress(roomName).catch((error: Error) => {
                logStream('error', `Failed to list egress: ${error.message}`, 'startRecording');
                throw error;
            });

            const activeEgresses = activeRooms?.filter(
                (info: { status: number; }) => info.status < 2,
            );

            if (activeEgresses?.length > 0) {
                await Promise.all(activeEgresses.map((info: { egressId: any; }) => 
                    this.egressSvc.stopEgress(info.egressId)
                )).catch((error) => {
                    console.log("Error : ", error);
                });
            }

            const timestamp = new Date();
            const s3Key = `${roomName}/${timestamp.toISOString().replace(/[:.]/g, '-')}.mp4`;
            
            // Define the output configuration
            const output = {
                file: {
                    fileType: 1, // MP4
                    output: {
                        case: 's3',
                        value: {
                            accessKey: AWS_ACCESS_KEY_ID,
                            secret: AWS_SECRET_ACCESS_KEY,
                            bucket: S3_BUCKET_NAME,
                            region: AWS_REGION,
                            key: s3Key,
                            metadata: {
                                roomName,
                                timestamp: timestamp.toISOString(),
                                doctorId: params?.doctorId || '',
                                patientId: params?.patientId || '',
                                visitId: params?.visitId || ''
                            }
                        },
                    },
                }
            };
            
            // Define the options
            const options = {
                layout: 'grid',
                encodingOptions: 'H264_1080P_30',
                videoOnly: false,
                audioOnly: false,
                grid: {
                    rows: 2,
                    columns: 2,
                }
            };

            logStream('debug', `Starting egress with output: ${JSON.stringify(output)}`, 'startRecording');
            logStream('debug', `Starting egress with options: ${JSON.stringify(options)}`, 'startRecording');

            const startEgressResponse = await this.egressSvc
                .startRoomCompositeEgress(roomName, output, options)
                .catch((error: Error) => {
                    logStream('error', `Failed to start egress: ${error.message}`, 'startRecording');
                    throw error;
                });

            if (!startEgressResponse?.egressId) {
                const error = 'Recording not started - No egress ID received';
                logStream('error', error, 'startRecording');
                throw new Error(error);
            }

            logStream('debug', `Recording started successfully with egressId: ${startEgressResponse.egressId}`, 'startRecording');

            // Construct the S3 URL
            const s3Url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

            // Store recording in call_recordings table with all required fields
            const recordingData = {
                room_id: params?.roomId,
                doctor_id: params?.doctorId,
                patient_id: params?.patientId,
                visit_id: params?.visitId,
                chw_id: params?.chwId,
                egress_id: startEgressResponse.egressId,
                file_path: s3Key,
                s3_url: s3Url,
                duration: null,
                start_time: timestamp,
                end_time: null,
                nurse_name: params?.nurseName
            };            

            const recording = await call_recordings.create(recordingData);

            return {
                egressId: startEgressResponse?.egressId,
                filePath: s3Key,
                recordingId: recording.id,
                startTime: timestamp,
                ...startEgressResponse,
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
            
            const activeRooms = await this.egressSvc.listEgress(roomName);

            const activeEgresses = activeRooms?.filter(
                (info: { status: number; }) => info.status < 2,
            );

            if (activeEgresses.length === 0) {
                return {
                    status: 404,
                    message: 'No active recording found',
                    success: false
                };
            }

            const endTime = new Date();

            // Stop all active egresses
            await Promise.all(activeEgresses.map(async (info: { egressId: any; }) => {
                await this.egressSvc.stopEgress(info.egressId);
                
                // Update the recording end time in database
                await call_recordings.update(
                    { end_time: endTime },
                    { where: { egress_id: info.egressId } }
                );

                // Wait a moment for the status to update
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const updatedEgressList = await this.egressSvc.listEgress(roomName);
                const stoppedEgress = updatedEgressList.find((e: any) => e.egressId === info.egressId);
                console.log(stoppedEgress, "STATATTATATTATSS", updatedEgressList);
            }));

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

