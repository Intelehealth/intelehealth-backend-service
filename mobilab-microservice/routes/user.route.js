const express = require("express");
const {
  getRoles,
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser
} = require("../controllers/user.controller");
const {
  getRolesSchema,
  getUsersSchema,
  userIdSchema,
  createUserSchema,
  updateUserSchema
} = require("../schema/user.schema");
const { authMiddleware } = require("../middleware/auth");
const { validate } = require("../middleware/validationMiddleware");
const router = express.Router();

router.get("/roles", [authMiddleware, validate(getRolesSchema, "query"), getRoles]);

router.get("/users", [authMiddleware, validate(getUsersSchema, "query"), getUsers]);
router.post("/users", [authMiddleware, validate(createUserSchema), createUser]);
router.get("/users/:id", [authMiddleware, validate(userIdSchema, "params"), getUser]);
router.patch("/users/:id", [authMiddleware, validate(userIdSchema, "params"), validate(updateUserSchema), updateUser]);
router.delete("/users/:id", [authMiddleware, validate(userIdSchema, "params"), deleteUser]);

module.exports = router;
