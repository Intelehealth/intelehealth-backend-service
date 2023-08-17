const router = require("express").Router();
const { createCompletion, createCompletion2, translateExcel, getGTPInputs, addGTPInput, setAsDefaultGTPInput, deleteGPTInput, getGPTModels, addGPTModel, setAsDefaultGPTModel, deleteGPTModel } = require("../controllers/openai.controller");
const multer  = require('multer');
const upload = multer({ dest: 'public/translate/uploads/' });

router.post("/ddx", createCompletion);
router.get("/gptInputs", getGTPInputs);
router.post("/addInput", addGTPInput);
router.post("/setAsDefaultInput", setAsDefaultGTPInput);
router.delete("/deleteInput/:id", deleteGPTInput);
router.get("/gptModels", getGPTModels);
router.post("/addModel", addGPTModel);
router.post("/setAsDefaultModel", setAsDefaultGPTModel);
router.delete("/deleteModel/:id", deleteGPTModel);
router.post("/translate", createCompletion2);
router.post("/translatexl", upload.single('file'), translateExcel);



module.exports = router;
