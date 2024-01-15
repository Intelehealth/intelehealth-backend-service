var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
var pushRouter = require("./routes/pushNotification");
const { log } = require("./handlers/helper");
const cors = require("cors");

var app = express();
global.log = log;

app.use(cors());

app.use(logger("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: false }));
app.use(bodyParser.text());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", indexRouter);
app.use("/notification", pushRouter);

module.exports = app;
