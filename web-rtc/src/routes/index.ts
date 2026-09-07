import { Router } from "express";
import { MainController } from "../controllers/main.controller";
import { MagicLinkController } from "../controllers/magic-link.controller";
import { CallStatusController } from "../controllers/call-status.controller";
import authMiddleware  from "../middleware/auth";

const router = Router();

class IndexRoute {
    constructor(
        private mainController: MainController,
        private magicLinkController: MagicLinkController,
        private callStatusController: CallStatusController
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
        router.get('/magic-link/j/:code', this.magicLinkController.joinShort)

        // Call-lifecycle webhooks -> QMS. Inert unless QMS_ENABLED=true.
        router.post('/call/connected', [authMiddleware, this.callStatusController.connected])
        router.post('/call/disconnected', [authMiddleware, this.callStatusController.disconnected])
        router.get('/call/qms-status', this.callStatusController.status)
    }
}

new IndexRoute(new MainController(), new MagicLinkController(), new CallStatusController());


export default router;
