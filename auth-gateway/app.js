const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const { authMiddleware } = require("./handlers/checkAuth");
const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const { errorHandler } = require("./handlers/errorHandller");
const cors = require("cors");
const Sequelize = require("sequelize");
const db = require("./models");
const c = 'A';
const app = express();
app.set("view engine", "html");

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS && JSON.parse(process.env.ALLOWED_ORIGINS) || [];

db.sequelize.define("Session", {
  sid: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  rememberme: Sequelize.BOOLEAN,
  expires: Sequelize.DATE,
  data: Sequelize.TEXT,
});

app.use(cors({
  origin: (origin, callback) => {
     if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
          callback(null, true)
      } else {
          callback(new Error('origin not allowed by Cors'))
      }
  },
  optionsSuccessStatus: 200,
  credentials: true
}));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/auth", authRouter);
app.use("/v2", authMiddleware, indexRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  swaggerOptions: {
    docExpansions: "none",
    persistAuthorization: true
  }
}));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(errorHandler);

module.exports = app;
