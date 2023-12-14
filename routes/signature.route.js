const router = require("express").Router();
const {
    createSign,
    uploadSign
} = require("../controllers/signature.controller");

router.post("/create", createSign);
router.post("/upload", uploadSign);

module.exports = router;