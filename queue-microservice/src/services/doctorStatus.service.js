const { Op, QueryTypes } = require("sequelize");
const moment = require("moment");

const models = require("../models");
const config = require("../config/env");
const logger = require("../utils/logger");
const { DOCTOR_STATUS, IN_SERVICE_STATUSES } = require("../constants");
const { BadRequestError } = require("../utils/errors");

/**
 * Live doctor status — backend LLD §02.2 and §09.3.
 *
 * "The most important new endpoint in this document." The Little's Law
 * production report named live doctor status as the #1 accuracy fix: naive wait
 * estimates were off by 168 minutes MAE without it, ~52 with it. Every
 * queue-facing screen must call the status endpoint on login, logout and idle
 * timeout, or the calibrated estimate degrades back toward the naive one.
 */

const upsertStatus = async (doctorUuid, patch, transaction) => {
  const now = new Date();
  const [row, created] = await models.doctor_queue_status.findOrCreate({
    where: { doctorUuid },
    defaults: {
      doctorUuid,
      status: DOCTOR_STATUS.OFFLINE,
      lastChangedAt: now,
      ...patch,
    },
    transaction,
  });

  if (!created) {
    await row.update({ ...patch, lastChangedAt: now }, { transaction });
  }
  return row;
};

const setStatus = async (doctorUuid, status, { speciality, queueEntryId = null } = {}) => {
  if (!Object.values(DOCTOR_STATUS).includes(status)) {
    throw new BadRequestError(
      `status must be one of: ${Object.values(DOCTOR_STATUS).join(", ")}`,
      "INVALID_DOCTOR_STATUS"
    );
  }

  const patch = { status };
  if (speciality !== undefined) patch.speciality = speciality;
  // Only in_consult carries a case reference; anything else clears it, so a
  // doctor who goes offline mid-call cannot leave a dangling pointer.
  patch.currentQueueEntryId = status === DOCTOR_STATUS.IN_CONSULT ? queueEntryId : null;

  const row = await upsertStatus(doctorUuid, patch);
  logger.info("Doctor status changed", { doctorUuid, status });
  return row;
};

const getStatus = async (doctorUuid) =>
  models.doctor_queue_status.findOne({ where: { doctorUuid } });

/**
 * The doctors:active:{speciality} equivalent — who is online for this
 * speciality right now. `in_consult` doctors are deliberately excluded: they
 * are present but not free.
 */
const listAvailable = async (speciality, { includeGeneral = true } = {}) => {
  const where = { status: DOCTOR_STATUS.ONLINE };
  if (speciality) {
    where[Op.or] = includeGeneral
      ? [{ speciality }, { speciality: { [Op.in]: ["General Physician", "General", "GP"] } }]
      : [{ speciality }];
  }
  return models.doctor_queue_status.findAll({ where });
};

/** Everyone signed in for a speciality, whether free or mid-consult. */
const countPresent = async (speciality) =>
  models.doctor_queue_status.count({
    where: {
      speciality,
      status: { [Op.in]: [DOCTOR_STATUS.ONLINE, DOCTOR_STATUS.IN_CONSULT] },
    },
  });

/** How many cases this doctor currently has in hand — the §06 queue-load term. */
const currentLoad = async (doctorUuid) =>
  models.queue_entries.count({
    where: { assignedDoctorUuid: doctorUuid, status: { [Op.in]: IN_SERVICE_STATUSES } },
  });

/**
 * Backend LLD §06 / §02 — "no off-day calls".
 *
 * The doc is explicit that this must reuse the day-off data the appointment
 * flow already owns (updateDaysOff / getScheduledMonths), not a new
 * doctor_schedules table. QMS therefore reads that existing table directly when
 * SHIFT_CHECK_ENABLED is on.
 *
 * Fails OPEN: if the table cannot be read, the doctor is treated as on shift.
 * A schema change in another service should not silently empty the queue.
 */
const isOnShift = async (doctorUuid) => {
  if (!config.queue.shiftCheckEnabled) return true;

  const today = moment().format("YYYY-MM-DD");
  try {
    const rows = await models.sequelize.query(
      `SELECT daysOff FROM \`${config.queue.shiftTable}\` WHERE userUuid = :doctorUuid`,
      { replacements: { doctorUuid }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return true;

    return !rows.some((row) => {
      let daysOff = row.daysOff;
      if (typeof daysOff === "string") {
        try {
          daysOff = JSON.parse(daysOff);
        } catch (_) {
          daysOff = [];
        }
      }
      if (!Array.isArray(daysOff)) return false;
      return daysOff.some((day) => String(day).slice(0, 10) === today);
    });
  } catch (err) {
    logger.warn("Shift check unavailable — treating doctor as on shift", {
      doctorUuid,
      error: err.message,
    });
    return true;
  }
};

module.exports = {
  setStatus,
  getStatus,
  listAvailable,
  countPresent,
  currentLoad,
  isOnShift,
  upsertStatus,
};
