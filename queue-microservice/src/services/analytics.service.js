const { Op } = require("sequelize");

const models = require("../models");
const priority = require("./priority.service");
const { WAITING_STATUSES, IN_SERVICE_STATUSES, DOCTOR_STATUS } = require("../constants");

/**
 * Analytics — backend LLD §09.4.
 *
 * Both endpoints ship in the same release as the queue itself, not as a
 * follow-up. §12 is explicit about why: /analytics/accuracy is what tells you
 * whether §07's calibration is still holding as real doctor behaviour drifts.
 * Without it the wait estimate can quietly rot back toward the naive,
 * 168-minute-MAE version and nobody would know.
 */

/** GET /api/queue/analytics/live — the ops view, per speciality. */
const live = async ({ speciality = null } = {}) => {
  const specialityFilter = speciality ? { speciality } : {};

  const waiting = await models.queue_entries.findAll({
    where: { status: { [Op.in]: WAITING_STATUSES }, ...specialityFilter },
    attributes: [
      "speciality",
      "emergencyLevel",
      "escalated",
      "queuedAt",
      "heartbeatFlagged",
      "estimatedWaitMin",
    ],
    raw: true,
  });

  const inService = await models.queue_entries.findAll({
    where: { status: { [Op.in]: IN_SERVICE_STATUSES }, ...specialityFilter },
    attributes: ["speciality"],
    raw: true,
  });

  const doctors = await models.doctor_queue_status.findAll({
    where: specialityFilter,
    attributes: ["speciality", "status"],
    raw: true,
  });

  const bySpeciality = new Map();
  const bucket = (name) => {
    if (!bySpeciality.has(name)) {
      bySpeciality.set(name, {
        speciality: name,
        queueDepth: 0,
        criticalWaiting: 0,
        escalatedWaiting: 0,
        heartbeatFlagged: 0,
        inService: 0,
        doctorsOnline: 0,
        doctorsInConsult: 0,
        doctorsAway: 0,
        longestWaitMin: 0,
        averageWaitMin: 0,
        averageEstimatedWaitMin: 0,
        utilization: 0,
      });
    }
    return bySpeciality.get(name);
  };

  const now = new Date();
  const waitTotals = new Map();
  const etaTotals = new Map();

  for (const entry of waiting) {
    const b = bucket(entry.speciality);
    b.queueDepth += 1;
    if (entry.emergencyLevel === "CRITICAL") b.criticalWaiting += 1;
    if (entry.escalated) b.escalatedWaiting += 1;
    if (entry.heartbeatFlagged) b.heartbeatFlagged += 1;

    const waited = priority.minutesWaited({ queuedAt: entry.queuedAt }, now);
    b.longestWaitMin = Math.max(b.longestWaitMin, Math.round(waited));

    const wt = waitTotals.get(entry.speciality) || { sum: 0, n: 0 };
    wt.sum += waited;
    wt.n += 1;
    waitTotals.set(entry.speciality, wt);

    if (Number.isFinite(entry.estimatedWaitMin)) {
      const et = etaTotals.get(entry.speciality) || { sum: 0, n: 0 };
      et.sum += entry.estimatedWaitMin;
      et.n += 1;
      etaTotals.set(entry.speciality, et);
    }
  }

  for (const entry of inService) bucket(entry.speciality).inService += 1;

  for (const doctor of doctors) {
    if (!doctor.speciality) continue;
    const b = bucket(doctor.speciality);
    if (doctor.status === DOCTOR_STATUS.ONLINE) b.doctorsOnline += 1;
    else if (doctor.status === DOCTOR_STATUS.IN_CONSULT) b.doctorsInConsult += 1;
    else if (doctor.status === DOCTOR_STATUS.AWAY) b.doctorsAway += 1;
  }

  for (const b of bySpeciality.values()) {
    const wt = waitTotals.get(b.speciality);
    if (wt?.n) b.averageWaitMin = Math.round(wt.sum / wt.n);
    const et = etaTotals.get(b.speciality);
    if (et?.n) b.averageEstimatedWaitMin = Math.round(et.sum / et.n);

    const present = b.doctorsOnline + b.doctorsInConsult;
    b.utilization = present ? Number((b.doctorsInConsult / present).toFixed(3)) : 0;
  }

  const specialities = [...bySpeciality.values()].sort((a, b) => b.queueDepth - a.queueDepth);

  return {
    generatedAt: now.toISOString(),
    totals: {
      waiting: waiting.length,
      inService: inService.length,
      doctorsPresent: doctors.filter((d) =>
        [DOCTOR_STATUS.ONLINE, DOCTOR_STATUS.IN_CONSULT].includes(d.status)
      ).length,
    },
    specialities,
  };
};

/**
 * GET /api/queue/analytics/accuracy — the always-on version of the Little's Law
 * accuracy report.
 *
 * Compares the estimate made when the case entered the queue against the wait
 * that actually happened, so the numbers are directly comparable to the
 * prototype's baseline: 168 min MAE / 17.6% within 15 min for the naive
 * formula, ~52 min MAE / 63.5% within 30 min after calibration.
 *
 * This is how the team decides when to re-tune eta_model_used or a speciality's
 * overhead constant (§07, §12).
 */
const accuracy = async ({ speciality = null, doctorUuid = null, sinceHours = 24 } = {}) => {
  const since = new Date(Date.now() - sinceHours * 3600 * 1000);

  const rows = await models.queue_entries.findAll({
    where: {
      queuedAt: { [Op.gte]: since },
      assignedAt: { [Op.ne]: null },
      initialEstimatedWaitMin: { [Op.ne]: null },
      ...(speciality ? { speciality } : {}),
      ...(doctorUuid ? { assignedDoctorUuid: doctorUuid } : {}),
    },
    attributes: [
      "speciality",
      "assignedDoctorUuid",
      "etaModelUsed",
      "queuedAt",
      "assignedAt",
      "initialEstimatedWaitMin",
    ],
    raw: true,
  });

  const samples = rows
    .map((row) => {
      const actual = (new Date(row.assignedAt) - new Date(row.queuedAt)) / 60000;
      return {
        speciality: row.speciality,
        doctorUuid: row.assignedDoctorUuid,
        model: row.etaModelUsed,
        predicted: row.initialEstimatedWaitMin,
        actual,
        error: row.initialEstimatedWaitMin - actual,
      };
    })
    .filter((s) => Number.isFinite(s.actual) && s.actual >= 0);

  const summarise = (list) => {
    if (!list.length) {
      return { samples: 0, maeMin: null, biasMin: null, within15Pct: null, within30Pct: null };
    }
    const absErrors = list.map((s) => Math.abs(s.error));
    const mae = absErrors.reduce((a, b) => a + b, 0) / list.length;
    const bias = list.reduce((a, s) => a + s.error, 0) / list.length;
    const within = (limit) =>
      Number(((absErrors.filter((e) => e <= limit).length / list.length) * 100).toFixed(1));
    return {
      samples: list.length,
      maeMin: Number(mae.toFixed(1)),
      // Negative bias = the estimate is running short, the failure mode the
      // naive formula had.
      biasMin: Number(bias.toFixed(1)),
      within15Pct: within(15),
      within30Pct: within(30),
    };
  };

  const groupBy = (key) => {
    const groups = new Map();
    for (const sample of samples) {
      const value = sample[key] || "unknown";
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(sample);
    }
    return [...groups.entries()].map(([value, list]) => ({ [key]: value, ...summarise(list) }));
  };

  return {
    windowHours: sinceHours,
    filters: { speciality, doctorUuid },
    overall: summarise(samples),
    bySpeciality: groupBy("speciality"),
    byModel: groupBy("model"),
    byDoctor: doctorUuid ? groupBy("doctorUuid") : undefined,
    baseline: {
      note:
        "Little's Law prototype, 1,222 real visits: naive formula 168 min MAE / 17.6% within 15 min; calibrated ~52 min MAE / 63.5% within 30 min. That calibration predates priority reordering — treat it as a starting point (LLD §07).",
    },
  };
};

/** Current overall MAE, used by the on-call alert job (§13.4). */
const currentMae = async (lookbackMin) => {
  const report = await accuracy({ sinceHours: lookbackMin / 60 });
  return report.overall;
};

module.exports = { live, accuracy, currentMae };
