const express = require("express");

const queueRoutes = require("./queue.route");
const doctorRoutes = require("./doctor.route");

const router = express.Router();

router.use("/queue", queueRoutes);
router.use("/doctor", doctorRoutes);

module.exports = router;
