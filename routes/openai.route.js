const router = require("express").Router();
const { createCompletion, getGTPInputs, addGTPInput, setAsDefaultGTPInput, deleteGPTInput } = require("../controllers/openai.controller");

router.post("/ddx", createCompletion);
router.get("/gptInputs", getGTPInputs);
router.post("/addInput", addGTPInput);
router.post("/setAsDefaultInput", setAsDefaultGTPInput);
router.delete("/deleteInput/:id", deleteGPTInput);

module.exports = router;
