require("dotenv").config();
const express = require("express");

const patientRegistration = require("./routes/patient-registration");
const visitPush = require("./routes/visit-push");

const app = express();

// Capture the raw body so a parse failure can be logged verbatim.
app.use(express.json({
   verify: (req, _res, buf) => { req.rawBody = buf?.length ? buf.toString("utf8") : ""; },
}));

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

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server running on ${port}`));
