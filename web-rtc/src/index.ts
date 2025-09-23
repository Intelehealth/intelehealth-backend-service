import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import IndexRouter from './routes';
import { WebSocketController } from './controllers/websocket.controller';
import * as http from 'http';
import * as https from 'https';
const cors = require('cors');
const c = 'OK';
class Server {
    app: express.Application;
    port: number = !isNaN(Number(process.env.PORT)) ? Number(process.env.PORT) : 3000;

    constructor() {
        let server;
        this.app = express();
        this.app.use(cors({
            // origin: "*"
            credentials: true,
            origin: true,
        }))
        console.log('SSL: ', process.env.SSL);
        if (process.env.SSL === 'true') {
            const fs = require("fs");
            const options = {
                key: fs.readFileSync(process.env.SSL_KEY_PATH),
                cert: fs.readFileSync(process.env.SSL_CERT_PATH),
            };
            server = https.createServer(options, this.app);
        } else {
            server = http.createServer(this.app);
        }
        server.listen(this.port, () => {
            console.log(`Server is running on ${this.port}`);
            console.log('----------*---------*--------');
        });
        this.init();
        new WebSocketController(server);
    }

    init() {
        this.app.use('/api', IndexRouter);
    }
};

new Server();
