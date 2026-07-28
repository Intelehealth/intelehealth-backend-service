"use strict";
const queueService = require("../services/queue.service");

const ok = (res, data) => res.json({ success: true, ...data });
const fail = (res, code, message) => res.status(code).json({ success: false, message });

module.exports = {
  // POST /queue  { visitUuid, patientId, patientName, specialty, priority? }
  async enqueue(req, res) {
    try {
      const { visitUuid, specialty } = req.body;
      if (!visitUuid) return fail(res, 400, "Missing visitUuid.");
      if (!specialty) return fail(res, 400, "Missing specialty.");
      const entry = await queueService.enqueue(req.body);
      return ok(res, { entry });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  // GET /queue/:specialty/next?doctorId=...
  async next(req, res) {
    try {
      const { doctorId } = req.query;
      if (!doctorId) return fail(res, 400, "Missing doctorId.");
      const entry = await queueService.claimNext(req.params.specialty, doctorId);
      if (!entry) return ok(res, { entry: null, message: "Queue is empty." });
      return ok(res, { entry });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  // POST /queue/:id/claim  { doctorId }  — pick a specific entry
  async claim(req, res) {
    try {
      const { doctorId } = req.body;
      if (!doctorId) return fail(res, 400, "Missing doctorId.");
      const entry = await queueService.claimById(req.params.id, doctorId);
      if (!entry) {
        // already taken — hand them the next one instead
        const next = await queueService.claimNext(req.body.specialty, doctorId);
        return ok(res, { entry: next, taken: true, message: "Already taken; allocated next patient." });
      }
      return ok(res, { entry });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  // POST /queue/in-call  { visitUuid, doctorId, roomId }  — from WebRTC startRecording
  async inCall(req, res) {
    try {
      const { visitUuid } = req.body;
      if (!visitUuid) return fail(res, 400, "Missing visitUuid.");
      const updated = await queueService.markInCall(req.body);
      return ok(res, { updated });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  // POST /queue/complete  { visitUuid | roomId }  — from WebRTC stopRecording / webhook
  async complete(req, res) {
    try {
      const { visitUuid, roomId } = req.body;
      if (!visitUuid && !roomId) return fail(res, 400, "Provide visitUuid or roomId.");
      const updated = await queueService.complete({ visitUuid, roomId });
      return ok(res, { updated });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  // GET /queue/busy/:visitUuid
  async busy(req, res) {
    try {
      const busy = await queueService.isBusy(req.params.visitUuid);
      return ok(res, { busy });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  // GET /queue/position/:visitUuid
  async position(req, res) {
    try {
      const pos = await queueService.position(req.params.visitUuid);
      if (!pos) return fail(res, 404, "Visit not found in queue.");
      return ok(res, pos);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },

  // GET /queue/:specialty
  async list(req, res) {
    try {
      const data = await queueService.listBySpecialty(req.params.specialty);
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  },
};
