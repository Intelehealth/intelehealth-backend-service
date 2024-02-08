import { WebRTCService } from "../services/webrtc.service";


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
        console.log('onConnection: ');
    }

    onWebSocketMessage(message: any) {
        console.log('message:onWebSocketMessage ', message);
    }

    onWebSocketError(err: any) {
        console.log('onWebSocketError:  --- ', err);
    }
}