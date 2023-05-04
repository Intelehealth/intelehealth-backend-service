const router = require("express").Router();
const { createCompletion } = require("../controllers/openai.controller");

router.post("/ddx", createCompletion);
module.exports = router;
