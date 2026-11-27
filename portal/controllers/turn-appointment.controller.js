const Constant = require("../constants/constant");
const { validateParams } = require("../handlers/helper");
const { logStream } = require("../logger/index");
const {
  getUserAppointmentSlots,
  bookAppointment,
} = require("../services/turn-appointment.service");

module.exports = (function () {
  const PHI_FIELDS = new Set([
    "patientName",
    "openMrsId",
    "patientId",
    "visitUuid",
    "drName",
  ]);

  const redactBody = (body) =>
    Object.fromEntries(
      Object.entries(body || {}).map(([k, v]) => [
        k,
        PHI_FIELDS.has(k) ? (v ? "[redacted]" : v) : v,
      ])
    );

  const logRequest = (req, tag) => {
    const fingerprint = {
      tag,
      ip: req.ip,
      forwardedFor: req.headers["x-forwarded-for"] || null,
      cfConnectingIp: req.headers["cf-connecting-ip"] || null,
      userAgent: req.headers["user-agent"] || null,
      turnHeaderKeys: Object.keys(req.headers).filter((k) => k.startsWith("x-turn-")),
      method: req.method,
      path: req.path,
      query: req.query,
      body: redactBody(req.body),
    };
    console.log("[TURN-REQ]", JSON.stringify(fingerprint));
    logStream("info", JSON.stringify(fingerprint), tag);
  };

  const logResponse = (tag, payload) => {
    const summary = {
      status: payload.status,
      alreadyBooked: payload.alreadyBooked,
      appointmentId: payload.data ? payload.data.id : undefined,
      slotCount: payload.data ? payload.data.count : undefined,
      joinUrl: payload.joinUrl ? "[issued]" : payload.joinUrl,
      message: payload.message,
    };
    console.log("[TURN-RES]", tag, JSON.stringify(summary));
    logStream("info", `RESPONSE ${JSON.stringify(summary)}`, tag);
  };

  const SLOT_QUERY_KEYS = [
    { key: Constant.FROM_DATE, type: "string" },
    { key: Constant.TO_DATE, type: "string" },
    { key: Constant.SPECIALITY, type: "string" },
  ];

  this.getAvailableSlots = async (req, res, next) => {
    const tag = "turn-appointment.getAvailableSlots";
    try {
      logRequest(req, tag);
      if (validateParams(req.query, SLOT_QUERY_KEYS)) {
        const data = await getUserAppointmentSlots({ ...req.query });
        const payload = { status: true, data };
        logResponse(tag, payload);
        res.json(payload);
      }
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  this.getUserAppointmentSlots = async (req, res, next) => {
    const tag = "turn-appointment.getUserAppointmentSlots";
    try {
      logRequest(req, tag);
      if (validateParams(req.query, SLOT_QUERY_KEYS)) {
        const { userUuid } = req.params;
        const data = await getUserAppointmentSlots({ ...req.query, userUuid });
        const payload = { status: true, data };
        logResponse(tag, payload);
        res.json(payload);
      }
    } catch (error) {
      logStream("error", error.message);
      next(error);
    }
  };

  this.bookAppointment = async (req, res, next) => {
    const tag = "turn-appointment.bookAppointment";
    try {
      logRequest(req, tag);
      const data = await bookAppointment(req.body || {});
      const payload = { status: true, ...data };
      logResponse(tag, payload);
      res.json(payload);
    } catch (error) {
      const payload = { status: false, message: error.message };
      logResponse(tag, payload);
      logStream("error", error.message);
      res.json(payload);
    }
  };

  return this;
})();
