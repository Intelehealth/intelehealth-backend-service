import { Router } from "express";
import { MainController } from "../controllers/main.controller";
import authMiddleware  from "../middleware/auth";

const router = Router();

class IndexRoute {
    constructor(
        private mainController: MainController
    ) {
        this.initRoutes();
    }

    initRoutes() {
        router.get('/getToken', [authMiddleware, this.mainController.getToken])
        router.post('/startRecording', [authMiddleware, this.mainController.startRecording])
        router.get('/stopRecording', [authMiddleware, this.mainController.stopRecording])
        router.post('/autoStartRecording', [authMiddleware, this.mainController.createRoomAuto])
    }
}

new IndexRoute(new MainController());


export default router;
