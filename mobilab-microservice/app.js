const createError = require("http-errors");
const express = require("express");
const cookieParser = require("cookie-parser");

const logger = require("morgan");

const indexRouter = require("./routes/index");
const { errorHandler } = require("./handlers/errorHandler");
const { createHealthRouter } = require("./handlers/health");
const cors = require("cors");

const app = express();

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS && JSON.parse(process.env.ALLOWED_ORIGINS) || [];

app.use(cors(
	{
		origin: (origin, callback) => {
			const theOrigin = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : null;
			if (theOrigin || !origin) {
				callback(null, true)
			} else {
				callback(new Error('origin not allowed by Cors'))
			}
		},
		optionsSuccessStatus: 200,
		credentials: true,
		exposedHeaders: ["Retry-After", "X-RateLimit-Remaining"]
	}
));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// No local database: readiness only reports the process itself.
app.use(createHealthRouter({
	service: "mobilab-microservice",
	databases: {},
}));

const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
	swaggerOptions: {
		persistAuthorization: true,
		responseInterceptor: (response) => {
			if (response.ok && /\/v1\/auth\/login$/.test(response.url) && response.body && response.body.token) {
				// eslint-disable-next-line no-undef -- serialized and run in the browser
				window.ui.preauthorizeApiKey("bearerAuth", response.body.token);
			}
			return response;
		}
	}
}));

app.use("/mobilab", indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	next(createError(404));
});

// error handler
app.use(errorHandler);

module.exports = app;
