import { WebSocketServer } from 'ws';
import { RoomServiceClient, Room, AccessToken, EgressClient, EncodedFileOutput, VideoGrant, EncodingOptionsPreset, EncodedFileType } from 'livekit-server-sdk';
import moment from 'moment';
const { logStream } = require("../logger/index");
const { call_recordings } = require("../models");
import jwt from 'jsonwebtoken';

export class WebRTCService {
    wss: WebSocketServer | null = null;
    liveSvc: RoomServiceClient | null = null;
    egressSvc: EgressClient | null = null;

    constructor() {
      //   this.initLiveSvc()
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
        // this.liveSvc.listRooms().then((rooms: Room[]) => {
        //     console.log('existing rooms', rooms);
        // });

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
            const strlocation = (params?.location) ? (params.location) : "Other";
            const timestamp = new Date();
            const formattedTime = moment().format('DD-MM-YYYY_HH:mm:ss');
            const output = {
                file: new EncodedFileOutput({
                    fileType: EncodedFileType.MP4,
                    // filepath: `${params?.visitId}_${BRANDNAME}_{room_name}_{time}`,
                    filepath: `${BRANDNAME}/${DOMAIN}/${strlocation}/recording-${formattedTime}`,
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
            const fileName = startEgressResponse?.fileResults?.[0]?.filename;
            const s3Url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileName}`;

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



    
    /**
     * Auto recording: create a room and start recording automatically 
     */
  
async createRoomWithAutoEgress(roomName: string, params?: {
  roomId?: string;
  doctorId?: string;
  patientId?: string;
  visitId?: string;
  chwId?: string;
  nurseName?: string;
  location?: string;
}) {
  try {
    if (!roomName) throw new Error('Missing roomName');

    console.log('[AutoEgress] Starting room creation with auto recording for room:', roomName);

    // Generate server-side token with roomCreate permission
    const token = jwt.sign(
      { video: { roomCreate: true } },
      process.env.SECRET as string,
      { issuer: process.env.API_KEY, expiresIn: '10m' }
    );

    console.log('[AutoEgress] Generated roomCreate token');

    const { BRANDNAME, DOMAIN } = process.env;
    const strlocation = params?.location || 'Other';
    const timestamp = new Date();
    const formattedTime = moment().format('DD-MM-YYYY_HH:mm:ss');

    // Build payload for auto recording
    const bodyPayload = {
      name: roomName,
      egress: {
        tracks: {
          filepath: `${BRANDNAME}/${DOMAIN}/${strlocation}/recording-${formattedTime}`,
          s3: {
            access_key: process.env.AWS_ACCESS_KEY_ID,
            secret: process.env.AWS_SECRET_ACCESS_KEY,
            bucket: process.env.S3_BUCKET_NAME,
            region: process.env.AWS_REGION,
            metadata: {
              doctorId: params?.doctorId || '',
              patientId: params?.patientId || '',
              visitId: params?.visitId || '',
              chwId: params?.chwId || '',
              nurseName: params?.nurseName || '',
              location: params?.location || '',
            },
          } as any, // cast to any to avoid TS type error
        },
      },
    };

    console.log('[AutoEgress] CreateRoom payload:', JSON.stringify(bodyPayload, null, 2));

    // Call LiveKit CreateRoom endpoint
    const response = await fetch(`${process.env.LIVEHOST}/twirp/livekit.RoomService/CreateRoom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[AutoEgress] LiveKit CreateRoom failed:', text);
      throw new Error(`LiveKit create room failed: ${text}`);
    }

    const responseJson = await response.json();
    console.log('[AutoEgress] LiveKit CreateRoom success:', responseJson);

    console.log('[AutoEgress] Auto recording should now be active for this room');

    return responseJson;

  } catch (err: any) {
    console.error('[AutoEgress] Error in createRoomWithAutoEgress:', err?.message, err?.stack);
    throw new Error(err?.message || 'Failed to create room with auto recording');
  }
}

}