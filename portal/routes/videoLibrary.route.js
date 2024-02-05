const authMiddleware = require("../middleware/auth");

const express = require("express");

const {
  createProject,
  getAllProjects,
  getProjectByProjectId,
  createVideo,
  updateVideo,
  deleteVideo,
} = require("../controllers/videoLibrary.controller");

const router = express.Router();

router.post("/createProject", [authMiddleware, createProject]);
router.post("/createVideo", [authMiddleware, createVideo]);

router.get("/getAllProjects", [authMiddleware, getAllProjects]);
router.get("/getVideosByPackageId/:packageId", [
  authMiddleware,
  getProjectByProjectId,
]);

router.patch("/updateProject/:id", [authMiddleware, updateProject]);
router.patch("/updateVideo/:id", [authMiddleware, updateVideo]);

router.delete("/deleteProject/:id", [authMiddleware, deleteProject]);
router.delete("/deleteVideo/:id", [authMiddleware, deleteVideo]);

module.exports = router;
