const router = require("express").Router();
const {
    createSign,
    uploadSign
} = require("../controllers/signature.controller");
const authMiddleware = require("../middleware/auth");

router.post("/create", [authMiddleware,createSign]);
router.post("/upload", [authMiddleware,uploadSign]);

module.exports = router;
