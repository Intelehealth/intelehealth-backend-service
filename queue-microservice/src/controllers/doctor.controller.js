const doctorStatus = require("../services/doctorStatus.service");
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

  const { row, requestedStatus, heldInConsult } = await doctorStatus.changeStatus(doctorUuid, status, {
    speciality,
  });

  // Coming online assigns nothing — the doctor takes the next case themselves.
  return success(res, {
    ...toStatusItem(row),
    requestedStatus,
    heldInConsult,
  });
};

const toStatusItem = (row) => ({
  doctorUuid: row.doctorUuid,
  status: row.status,
  speciality: row.speciality,
  currentQueueEntryId: row.currentQueueEntryId,
  lastChangedAt: row.lastChangedAt,
});

/** GET /api/doctor/status — admin-only list, filterable by speciality/status. */
const listStatuses = async (req, res) => {
  const rows = await doctorStatus.listStatuses(req.validatedQuery);
  return success(res, rows.map(toStatusItem));
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

module.exports = { updateStatus, getStatus, listStatuses };
