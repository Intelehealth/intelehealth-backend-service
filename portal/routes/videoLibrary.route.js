const authMiddleware = require("../middleware/auth");

const express = require("express");

const {
  createCategory,
  getAllCategories,
  getVideosByCategoryId,
  createVideo,
  updateCategory,
  updateVideo,
  deleteCategory,
  deleteVideo,
} = require("../controllers/videoLibrary.controller");

const router = express.Router();

router.post("/createCategory", [authMiddleware, createCategory]);
router.post("/createVideo", [authMiddleware, createVideo]);

router.get("/getAllCategories", [authMiddleware, getAllCategories]);
router.get("/getVideosByCategoryId/:categoryId", [
  authMiddleware,
  getVideosByCategoryId,
]);

router.patch("/updateCategory/:id", [authMiddleware, updateCategory]);
router.patch("/updateVideo/:id", [authMiddleware, updateVideo]);
router.patch("/updateCategoryId/:videoId", [authMiddleware, updateCategoryIdOfVideo]);

router.delete("/deleteCategory/:id", [authMiddleware, deleteCategory]);
router.delete("/deleteVideo/:id", [authMiddleware, deleteVideo]);

module.exports = router;
