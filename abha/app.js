const rateLimit = require('express-rate-limit')

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const logger = require("morgan");

const abhaRouter = require("./routes/abha");
const { errorHandler } = require("./handlers/errorHandller");
const cors = require("cors");

const app = express();
app.set("view engine", "html");

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS && JSON.parse(process.env.ALLOWED_ORIGINS) || [];

app.use(cors(
	{
		origin: (origin, callback) => {
			const theOrigin = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : null;
			if (theOrigin) {
				callback(null, true)
			} else {
				callback(new Error('origin not allowed by Cors'))
			}
		},
		optionsSuccessStatus: 200,
		credentials: true,
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders: 'Content-Type, Authorization'
	}
));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
})

app.use(limiter)

app.use("/abha", abhaRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	next(createError(404));
});

// error handler
app.use(errorHandler);

module.exports = app;
