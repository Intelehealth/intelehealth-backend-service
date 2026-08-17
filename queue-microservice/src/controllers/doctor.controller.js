const doctorStatus = require("../services/doctorStatus.service");
const queueService = require("../services/queue.service");
const { success } = require("../utils/apiResponse");
const { NotFoundError } = require("../utils/errors");

/** Doctor live status — backend LLD §09.3. */

/**
 * PATCH /api/doctor/:doctorUuid/status
 *
 * The most important new endpoint in the LLD. Every queue-facing screen must
 * call it on login, logout and idle timeout — it is what closes the accuracy
 * gap the Little's Law production report identified.
 *
 * Authorisation (§13.1): a doctor can only change their own status; overriding
 * someone else's requires an admin role. Enforced by selfOrAdmin on the route.
 */
const updateStatus = async (req, res) => {
  const { doctorUuid } = req.params;
  const { status, speciality } = req.validated;

  const row = await doctorStatus.setStatus(doctorUuid, status, { speciality });

  // A doctor coming online is a dispatch trigger: case-first, the front of
  // their lane gets looked at straight away rather than waiting for the next
  // submit.
  let dispatched = [];
  if (status === "online" && row.speciality) {
    dispatched = await queueService.dispatchLane({ speciality: row.speciality });
  }

  return success(res, {
    doctorUuid: row.doctorUuid,
    status: row.status,
    speciality: row.speciality,
    currentQueueEntryId: row.currentQueueEntryId,
    lastChangedAt: row.lastChangedAt,
    dispatched,
  });
};

/**
 * GET /api/doctor/:doctorUuid/status — the durable copy, for reporting.
 * Live queue decisions read through the queue service, not this endpoint.
 */
const getStatus = async (req, res) => {
  const row = await doctorStatus.getStatus(req.params.doctorUuid);
  if (!row) throw new NotFoundError("No status recorded for this doctor", "DOCTOR_STATUS_NOT_FOUND");
  return success(res, row);
};

module.exports = { updateStatus, getStatus };
