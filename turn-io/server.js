require("dotenv").config();
const express = require("express");

const patientRegistration = require("./routes/patient-registration");
const visitPush = require("./routes/visit-push");
const prescription = require("./prescription");

const app = express();

// CORS (portal-style, driven by ALLOWED_ORIGINS as a JSON array). Needed for
// browser callers like the doctor webapp. Preflight OPTIONS is answered here
// with 204 so the browser's preflight check passes.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS && JSON.parse(process.env.ALLOWED_ORIGINS)) || [];
app.use((req, res, next) => {
   const origin = req.headers.origin;
   const allowed = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : ALLOWED_ORIGINS[0];
   if (allowed) res.header("Access-Control-Allow-Origin", allowed);
   res.header("Access-Control-Allow-Credentials", "true");
   res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
   if (req.method === "OPTIONS") return res.sendStatus(204);
   next();
});

// Capture the raw body so a parse failure can be logged verbatim.
app.use(express.json({
   verify: (req, _res, buf) => { req.rawBody = buf?.length ? buf.toString("utf8") : ""; },
}));

// Some Turn HTTP cards send form-urlencoded bodies (key=value&key=value)
// instead of JSON; accept those too so req.body is populated either way.
app.use(express.urlencoded({ extended: true }));

// Turn occasionally posts a malformed body; log the raw bytes and reply 400
// instead of letting Express return an HTML stack trace.
app.use((err, req, res, next) => {
   if (err?.type === "entity.parse.failed") {
      console.error(`[body-parse] invalid JSON on ${req.method} ${req.originalUrl}: ${JSON.stringify(req.rawBody)}`);
      return res.status(400).json({ success: false, error: "Request body is not valid JSON" });
   }
   return next(err);
});

app.get("/", (_req, res) => res.send("Server working"));

app.use("/webhooks/turn", patientRegistration);
app.use("/webhooks/turn", visitPush);
app.use("/webhooks/turn", prescription);

const port = process.env.PORT || 3000;

// In prod, terminate HTTPS here (per-service TLS, like the portal's bin/www):
// load the cert/key from SSL_CERT / SSL_PRIVATE_KEY. Otherwise serve plain HTTP.
if (process.env.NODE_ENV === "prod") {
   const https = require("https");
   const fs = require("fs");
   const options = {
      key: fs.readFileSync(process.env.SSL_PRIVATE_KEY),
      cert: fs.readFileSync(process.env.SSL_CERT),
   };
   https.createServer(options, app).listen(port, () =>
      console.log(`Server running on ${port} (https)`)
   );
} else {
   app.listen(port, () => console.log(`Server running on ${port} (http)`));
}
