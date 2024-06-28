const router = require("express").Router();
const { createCompletion, createCompletion2, translateExcel, getGTPInputs, addGTPInput, setAsDefaultGTPInput, deleteGPTInput, getGPTModels, addGPTModel, setAsDefaultGPTModel, deleteGPTModel } = require("../controllers/openai.controller");
const multer = require('multer');
const authMiddleware = require("../middleware/auth");
const upload = multer({ dest: 'translate/uploads/' });

router.post("/ddx", [authMiddleware, createCompletion]);
router.get("/gptInputs", [authMiddleware, getGTPInputs]);
router.post("/addInput", [authMiddleware, addGTPInput]);
router.post("/setAsDefaultInput", [authMiddleware, setAsDefaultGTPInput]);
router.delete("/deleteInput/:id", [authMiddleware, deleteGPTInput]);
router.get("/gptModels", [authMiddleware, getGPTModels]);
router.post("/addModel", [authMiddleware, addGPTModel]);
router.post("/setAsDefaultModel", [authMiddleware, setAsDefaultGPTModel]);
router.delete("/deleteModel/:id", [authMiddleware, deleteGPTModel]);
router.post("/translate", [authMiddleware, createCompletion2]);
router.post("/translatexl", [authMiddleware, upload.single('file'), translateExcel]);



module.exports = router;
