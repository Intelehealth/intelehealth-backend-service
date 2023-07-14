const router = require("express").Router();
const { createCompletion, getGTPInputs, addGTPInput, setAsDefaultGTPInput, deleteGPTInput, getGPTModels, addGPTModel, setAsDefaultGPTModel, deleteGPTModel } = require("../controllers/openai.controller");

router.post("/ddx", createCompletion);
router.get("/gptInputs", getGTPInputs);
router.post("/addInput", addGTPInput);
router.post("/setAsDefaultInput", setAsDefaultGTPInput);
router.delete("/deleteInput/:id", deleteGPTInput);
router.get("/gptModels", getGPTModels);
router.post("/addModel", addGPTModel);
router.post("/setAsDefaultModel", setAsDefaultGPTModel);
router.delete("/deleteModel/:id", deleteGPTModel);

module.exports = router;
