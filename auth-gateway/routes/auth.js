var express = require("express");
const {
  login,
  createUser,
  validateUser,
  getUsers,
  updateUser,
  deleteUser
} = require("../controller/auth.controller");
const authMiddleware = require("../handlers/auth");
var router = express.Router();

router.post("/login", login);
router.post("/createUser", [authMiddleware, createUser]);
router.post("/user/:uuid", [authMiddleware, updateUser]);
router.get("/users", [authMiddleware, getUsers]);
router.delete("/user/:uuid", [authMiddleware, deleteUser]);
router.post("/validateUser", [authMiddleware, validateUser]);

module.exports = router;
