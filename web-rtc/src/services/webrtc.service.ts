import { WebSocketServer } from 'ws';
import { RoomServiceClient, Room, AccessToken, EgressClient } from 'livekit-server-sdk';
const { logStream } = require("../logger/index");

export class WebRTCService {
    wss: WebSocketServer | null = null;
    liveSvc: any;
    egressSvc: any;

    constructor() {
        this.initLiveSvc()
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
            LIVEKIT_API_KEY,
            LIVEKIT_API_SECRET,
            LIVEHOST
        } = process.env;
        this.liveSvc = new RoomServiceClient(LIVEHOST as string, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
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

    async startRecording(roomName: string) {
        try {
            const {
                LIVEKIT_API_KEY,
                LIVEKIT_API_SECRET,
                LIVEHOST
            } = process.env;
            this.egressSvc = new EgressClient(LIVEHOST as string, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
            const egressData = {
                layout: 'grid',  // Layout for video streams (e.g., grid, speaker, etc.)
                encodingOptions: 'H264_1080P_30', // H264 video encoding preset (1080p at 30fps)
            };

            const startEgressResponse = await this.egressSvc
                .startRoomCompositeEgress(roomName, {
                    file: {
                        fileType: 1,
                        filepath: `/out/{room_name}_{time}`,
                        output: {
                            case: 'local',
                            value: "/out",
                        },
                    }
                }, egressData)

            if (!startEgressResponse?.egressId) {
                throw new Error("Recoding not started.")
            }

            return {
                egressId: startEgressResponse?.egressId,
                filePath: startEgressResponse?.file?.filename,
                success: true
            }
        } catch (err: any) {
            throw new Error(err.message)
        }
    }

    async stopRecording(roomName: string) {
        try {
            const {
                LIVEKIT_API_KEY,
                LIVEKIT_API_SECRET,
                LIVEHOST
            } = process.env;
            this.egressSvc = new EgressClient(LIVEHOST as string, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
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

            await Promise.all(activeEgresses.map((info: { egressId: any; }) => this.egressSvc.stopEgress(info.egressId)));

            return {
                activeEgresses,
                message: 'Stop active recording',
                success: true
            };
        } catch (err: any) {
            throw new Error(err.message)
        }
    }
}

