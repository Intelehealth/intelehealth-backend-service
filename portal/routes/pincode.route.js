const express = require("express");
const router = express.Router();
const { getPincode } = require("../controllers/pincode.controller");

router.get("/:pincode", getPincode);

module.exports = router;
