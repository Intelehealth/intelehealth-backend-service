"use strict";
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/queue.controller");

// write / state-changing
router.post("/", ctrl.enqueue);
router.post("/in-call", ctrl.inCall);
router.post("/complete", ctrl.complete);
router.post("/:id/claim", ctrl.claim);

// reads
router.get("/busy/:visitUuid", ctrl.busy);
router.get("/position/:visitUuid", ctrl.position);
router.get("/:specialty/next", ctrl.next);
router.get("/:specialty", ctrl.list);

module.exports = router;
