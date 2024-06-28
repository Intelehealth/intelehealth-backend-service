import { WebSocketServer } from 'ws';
import { RoomServiceClient, Room, AccessToken } from 'livekit-server-sdk';
const { logStream } = require("../logger/index");

export class WebRTCService {
    wss: WebSocketServer | null = null;
    liveSvc: any;

    constructor() { }

    startWebSocketServer({
        server,
        onConnection,
        onWebSocketMessage,
        onWebSocketError
    }: any) {
        logStream('debug','API calling', 'Start Web Socket Server');
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws) => {
            ws.on('error', onWebSocketError);

            ws.on('message', onWebSocketMessage);

            ws.send('Connected.');

            onConnection(ws);
        })
        logStream('debug',`The WebSocket server is running on port ${process.env.PORT}`,'Start Web Socket Server');
    }

    initLiveSvc() {
        const livekitHost: any = process.env.LIVEHOST;
        this.liveSvc = new RoomServiceClient(livekitHost, process.env.API_KEY, process.env.SECRET);

        return this.liveSvc;
    }


    getToken(roomName: string, participantName: string, opts = {}) {
        let options = { roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, exp: '10 days' };

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
        const opts = {
            name: 'myroom',
            // timeout in seconds
            emptyTimeout: 10 * 60,
            maxParticipants: 20,
        };
        this.liveSvc.createRoom(opts).then((room: Room) => {
            console.log('room created', room);
        });

        // delete a room
        this.liveSvc.deleteRoom('myroom').then(() => {
            console.log('room deleted');
        });
    }
}