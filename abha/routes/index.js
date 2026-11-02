const express = require("express");
const router = express.Router();
const proxy = require("express-http-proxy");

/* Mindmap Node API. */
router.use("/node", proxy("127.0.0.1:3004"));

// example - for adding more services to the gateway
// router.use("/openmrs", proxy("localhost/openmrs"));
// router.use("/py", proxy("localhost:8080"));

module.exports = router;
