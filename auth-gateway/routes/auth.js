var express = require("express");

const {
  login,
  createUser,
  validateUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  resetPassword,
  getProvider,
  setProvider
} = require("../controller/auth.controller");
const authMiddleware = require("../handlers/auth");
const {
  resetPassswordSchema,
  resetPassswordParamSchema,
  createUserSchema,
  validateUserSchema,
  deleteUserParamSchema,
  loginSchema,
  updateUserParamSchema,
  updateUserSchema
} = require("../validator/auth.validator");
const { validate, validateParams } = require("../middleware/validationMiddleware");
var router = express.Router();

router.get("/users", [
  authMiddleware,
  getUsers
]);

router.post("/login", [validate(loginSchema), login]);
router.post("/createUser", [
  authMiddleware,
  validate(createUserSchema),
  createUser
]);
router.get("/user/:user_uuid", [authMiddleware, getUser]);
router.get("/provider/:user_uuid", [authMiddleware, getProvider]);
router.post("/provider/:user_uuid", [authMiddleware, setProvider]);
router.post("/user/:uuid", [
  authMiddleware,
  validateParams(updateUserParamSchema),
  validate(updateUserSchema),
  updateUser
]);
router.delete("/user/:uuid", [
  authMiddleware,
  validateParams(deleteUserParamSchema),
  deleteUser
]);

router.post("/validateUser", [
  authMiddleware,
  validate(validateUserSchema),
  validateUser
]);
router.post("/user/reset-password/:uuid", [
  authMiddleware,
  validateParams(resetPassswordParamSchema),
  validate(resetPassswordSchema),
  resetPassword
]);

module.exports = router;
