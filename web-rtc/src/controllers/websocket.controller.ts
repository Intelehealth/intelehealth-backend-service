import { WebRTCService } from "../services/webrtc.service";
const { logStream } = require("../logger/index");

export class WebSocketController {
    token: string = "";

    constructor(server: any, private webrtcSvc: WebRTCService = new WebRTCService()) {
        this.init(server);
    }

    init(server: any) {
        this.webrtcSvc?.startWebSocketServer({
            server,
            onConnection: this.onWebSocketConnection,
            onWebSocketError: this.onWebSocketError,
            onWebSocketMessage: this.onWebSocketMessage
        });

        // this.token = this.webrtcSvc.getToken("myRoom1", "zee2");
        // console.log('this.token: 's, this.token);
    }

    onWebSocketConnection(ws: any) {
        logStream('debug','onConnection', 'On WebSocket Connection');
    }

    onWebSocketMessage(message: any) {
        logStream('debug', JSON.stringify(message), 'On WebSocket Message')
    }

    onWebSocketError(err: any) {
        logStream('debug', JSON.stringify(err), 'On WebSocket Error')
    }
}