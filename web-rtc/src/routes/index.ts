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
        // router.get('/getToken', this.mainController.getToken)
        router.get('/getToken', [authMiddleware, this.mainController.getToken])
    }
}

new IndexRoute(new MainController());


export default router;
