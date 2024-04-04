var express = require("express");
const { login } = require("../controller/auth.controller");
var router = express.Router();

router.post("/login", login);

module.exports = router;
