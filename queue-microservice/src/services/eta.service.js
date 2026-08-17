const { Op } = require("sequelize");

const models = require("../models");
const config = require("../config/env");
const { ETA_MODEL, DOCTOR_STATUS } = require("../constants");
const queueLane = require("./queueLane.service");

/**
 * Estimated wait time — backend LLD §07.
 *
 * NOT the naive `(position − 1) × avg_consult_time`. That shape was tested
 * against 1,222 real Intelehealth visits: 168 minutes mean absolute error,
 * correlation 0.069, only 17.6% of estimates within 15 minutes. It
 * underestimates badly because it ignores doctors already mid-consultation and
 * assumes zero system overhead.
 *
 * Correcting for exactly those two effects brought it to ~52 minutes MAE and
 * 63.5% within 30 minutes:
 *
 *   eta_min = ( Lq_doctor / (c × μ_doctor) ) + overhead[speciality]
 *
 *   Lq_doctor = cases ahead in the PRIORITY-SORTED queue + cases currently
 *               in-service for this speciality
 *   c         = 1 for Model B (doctor-level) · active doctor count for Model A
 *   μ_doctor  = 1 / doctor_service_stats.avg_consult_min
 *   overhead  = per-speciality constant, ~19-20 min baseline
 *
 * Lq comes from the live rank, never from arrival order. Once the priority
 * engine can move cases around, "arrived earlier" stops meaning "ahead in
 * line", and counting arrivals would quietly under-promise for anyone
 * leapfrogged (§07's honesty note, and Priority Engine §06).
 *
 * The 168 → 52 calibration was measured before any priority reordering
 * existed. Treat it as a starting point: /api/queue/analytics/accuracy is
 * live from day one so the overhead constant can be re-tuned against reality.
 */

const fallbackConsultMin = () => config.queue.defaultConsultSeconds / 60;

const modelFor = (speciality) => {
  const chosen = config.eta.modelBySpeciality?.[speciality];
  const model = String(chosen || config.eta.defaultModel).toUpperCase();
  return ETA_MODEL[model] ? model : ETA_MODEL.B;
};

const overheadFor = (speciality) => {
  const value = config.eta.overheadBySpeciality?.[speciality];
  return Number.isFinite(Number(value)) ? Number(value) : config.eta.defaultOverheadMin;
};

/** μ inputs for a speciality: pooled mean consult time and how many doctors. */
const pooledStats = async (speciality) => {
  const present = await models.doctor_queue_status.findAll({
    where: {
      speciality,
      status: { [Op.in]: [DOCTOR_STATUS.ONLINE, DOCTOR_STATUS.IN_CONSULT] },
    },
    attributes: ["doctorUuid"],
  });

  const uuids = present.map((row) => row.doctorUuid);
  if (!uuids.length) return { doctorCount: 0, avgConsultMin: fallbackConsultMin() };

  const stats = await models.doctor_service_stats.findAll({
    where: { doctorUuid: { [Op.in]: uuids } },
    attributes: ["avgConsultMin"],
  });

  const values = stats.map((s) => Number(s.avgConsultMin)).filter((n) => Number.isFinite(n) && n > 0);
  const avg = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : fallbackConsultMin();

  return { doctorCount: uuids.length, avgConsultMin: avg };
};

const doctorConsultMin = async (doctorUuid) => {
  if (!doctorUuid) return null;
  const stats = await models.doctor_service_stats.findByPk(doctorUuid);
  const value = Number(stats?.avgConsultMin);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * A per-request memo for the inputs that are shared across every case in a
 * speciality. Estimating a list of N cases one at a time would re-read the same
 * in-service count and the same pooled doctor stats N times; with a cache it is
 * once per speciality.
 */
const makeCache = () => ({ inService: new Map(), pooled: new Map(), doctor: new Map() });

const memo = (cache, bucket, key, load) => {
  if (!cache) return load();
  const store = cache[bucket];
  if (!store.has(key)) store.set(key, load());
  return store.get(key);
};

/**
 * @param entry     the queue entry being estimated for
 * @param position  its live rank (from queueLane.getPosition) — pass it in if
 *                  you already have it, otherwise it is read here
 * @param cache     optional makeCache() memo, for estimating many cases at once
 */
const estimate = async (entry, { position = null, cache = null } = {}) => {
  const scope = { speciality: entry.speciality, locationUuid: entry.locationUuid };
  const model = modelFor(entry.speciality);
  const overhead = overheadFor(entry.speciality);
  const scopeKey = `${entry.speciality}::${entry.locationUuid || ""}`;

  const [rank, inService, pooled] = await Promise.all([
    position !== null ? Promise.resolve(position) : queueLane.getPosition(entry),
    memo(cache, "inService", scopeKey, () => queueLane.getInServiceCount(scope)),
    memo(cache, "pooled", entry.speciality, () => pooledStats(entry.speciality)),
  ]);

  const ahead = Math.max(0, (rank || 1) - 1);
  const lq = ahead + inService;

  let servers;
  let avgConsultMin;
  if (model === ETA_MODEL.A) {
    // Model A — speciality-pooled: the whole speciality is one service centre.
    servers = Math.max(1, pooled.doctorCount);
    avgConsultMin = pooled.avgConsultMin;
  } else {
    // Model B — doctor-level: c = 1, μ from the specific doctor when the case
    // already has one, otherwise the speciality's pooled mean as the best
    // available estimate of whoever picks it up.
    servers = 1;
    const own = entry.assignedDoctorUuid
      ? await memo(cache, "doctor", entry.assignedDoctorUuid, () =>
          doctorConsultMin(entry.assignedDoctorUuid)
        )
      : null;
    avgConsultMin = own ?? pooled.avgConsultMin;
  }

  // Lq / (c × μ) with μ = 1 / avgConsultMin  ⇒  Lq × avgConsultMin / c
  const serviceMinutes = (lq * avgConsultMin) / servers;
  const etaMinutes = Math.max(0, Math.round(serviceMinutes + overhead));

  return {
    etaMinutes,
    model,
    inputs: {
      position: rank,
      casesAhead: ahead,
      inService,
      lq,
      servers,
      avgConsultMin: Number(avgConsultMin.toFixed(2)),
      overheadMin: overhead,
      doctorsPresent: pooled.doctorCount,
    },
  };
};

/**
 * Estimate a whole page of cases, sharing one cache across them.
 *
 * @param entries      queue entries
 * @param positionById Map(id → live position); entries missing from it are
 *                     ranked individually
 * @returns Map(id → { etaMinutes, model, inputs })
 */
const estimateMany = async (entries, positionById = new Map()) => {
  const cache = makeCache();
  const out = new Map();
  for (const entry of entries) {
    try {
      out.set(entry.id, await estimate(entry, { position: positionById.get(entry.id) ?? null, cache }));
    } catch (_) {
      out.set(entry.id, null);
    }
  }
  return out;
};

module.exports = { estimate, estimateMany, makeCache, modelFor, overheadFor, pooledStats };
