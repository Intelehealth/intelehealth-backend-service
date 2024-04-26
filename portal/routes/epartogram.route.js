const express = require("express");
const router = express.Router();
const { getConfiguration,addUpdateConfiguration } = require("../controllers/epartogram.controller");
const authMiddleware = require("../middleware/auth");

router.get("/configuration", [authMiddleware, getConfiguration]);
router.post("/configuration", [authMiddleware, addUpdateConfiguration]);

module.exports = router;