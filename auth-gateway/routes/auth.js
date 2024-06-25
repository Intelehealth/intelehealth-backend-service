var express = require("express");

const {
  login,
  createUser,
  validateUser,
  getUsers,
  updateUser,
  deleteUser,
  resetPassword
} = require("../controller/auth.controller");
const authMiddleware = require("../handlers/auth");
const { resetPassswordSchema, resetPassswordParamSchema } = require("../validator/auth.validator");
const { validate, validateParams } = require("../middleware/validationMiddleware");
var router = express.Router();

router.post("/login", login);
router.post("/createUser", [authMiddleware, createUser]);
router.post("/user/:uuid", [authMiddleware, updateUser]);
router.get("/users", [authMiddleware, getUsers]);
router.delete("/user/:uuid", [authMiddleware, deleteUser]);
router.post("/validateUser", [authMiddleware, validateUser]);
router.post("/user/reset-password/:uuid", [
  authMiddleware,
  validateParams(resetPassswordParamSchema),
  validate(resetPassswordSchema),
  resetPassword
]);

module.exports = router;
