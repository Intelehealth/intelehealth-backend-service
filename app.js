const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const logger = require("morgan");
const cookieSession = require("cookie-session");

const indexRouter = require("./routes/index");
const pushRouter = require("./routes/pushNotification");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/config/config.json")[env];

const app = express();

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(logger("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: false }));
app.use(bodyParser.text());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  cookieSession({
    name: "session",
    keys: [config.domain],
    maxAge: 15 * 24 * 60 * 60 * 1000, /** 15 days */
  })
);

app.use("/api", indexRouter);
app.use("/notification", pushRouter);
app.use(require("./handlers/error-handler"));

module.exports = app;
