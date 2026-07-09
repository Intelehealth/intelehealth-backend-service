import { Router } from "express";
import { MainController } from "../controllers/main.controller";
import { MagicLinkController } from "../controllers/magic-link.controller";
import authMiddleware  from "../middleware/auth";

const router = Router();

class IndexRoute {
    constructor(
        private mainController: MainController,
        private magicLinkController: MagicLinkController
    ) {
        this.initRoutes();
    }

    initRoutes() {
        router.get('/getToken', [authMiddleware, this.mainController.getToken])
        router.post('/startRecording', [authMiddleware, this.mainController.startRecording])
        router.get('/stopRecording', [authMiddleware, this.mainController.stopRecording])
        router.post('/magic-link', [authMiddleware, this.magicLinkController.generate])
        router.get('/magic-link/redeem', this.magicLinkController.redeem)
        router.get('/magic-link/room-status', this.magicLinkController.roomStatus)
    }
}

new IndexRoute(new MainController(), new MagicLinkController());


export default router;
