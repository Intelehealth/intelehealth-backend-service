import { Router } from "express";
import { MainController } from "../controllers/main.controller";

const router = Router();

class IndexRoute {
    constructor(
        private mainController: MainController
    ) {
        this.initRoutes();
    }

    initRoutes() {
        router.get('/getToken', this.mainController.getToken)
    }
}

new IndexRoute(new MainController());


export default router;
