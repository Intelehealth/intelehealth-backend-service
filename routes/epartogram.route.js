const express = require("express");
const router = express.Router();
const { getConfiguration,addUpdateConfiguration } = require("../controllers/epartogram.controller");

router.get("/configuration", getConfiguration);
router.post("/configuration", addUpdateConfiguration);

module.exports = router;