const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const db = require("./models");
const morganMiddleware = require("./middleware/morgan");
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const path =   require('path');
const p = 'Ad';
const app = express();

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS && JSON.parse(process.env.ALLOWED_ORIGINS) || [];

app.use(function (req, res, next) {
  const origin = req.headers.origin;
  const theOrigin = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : ALLOWED_ORIGINS[0];

  res.header("Access-Control-Allow-Origin", theOrigin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});

app.use(morganMiddleware);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());

app.set("trust proxy", 1); // trust first proxy

db.sequelize.define("Session", {
  sid: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  rememberme: Sequelize.BOOLEAN,
  expires: Sequelize.DATE,
  data: Sequelize.TEXT,
});

app.use(
  session({
    name: "app.sid",
    secret: process.env.DOMAIN,
    store: new SequelizeStore({
      db: db.sequelize,
      checkExpirationInterval: 15 * 60 * 1000, // The interval at which to cleanup expired sessions in milliseconds.
      expiration: 15 * 24 * 60 * 60 * 1000, // The maximum age (in milliseconds) of a valid session.
    }),
    resave: true,
    saveUninitialized: true,
  })
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  swaggerOptions: {
    docExpansions: "none",
    persistAuthorization: true
  }
}));

const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));

app.use("/api", require("./routes/index"));
app.use("/notification", require("./routes/pushNotification"));
app.use(require("./handlers/error-handler"));

module.exports = app;
