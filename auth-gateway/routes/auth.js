var express = require("express");
const {
  login,
  createUser,
  validateUser,
} = require("../controller/auth.controller");
const authMiddleware = require("../handlers/auth");
var router = express.Router();

router.post("/login", login);
router.post("/createUser", [authMiddleware, createUser]);
router.post("/validateUser", [authMiddleware, validateUser]);

module.exports = router;
