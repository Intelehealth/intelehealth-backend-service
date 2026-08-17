const models = require("../models");
const config = require("../config/env");
const priorityConfig = require("./priorityConfig.service");
const doctorStatus = require("./doctorStatus.service");
const { matchLevel } = require("../utils/speciality");
const { SPEC_MATCH } = require("../constants");

/**
 * Doctor assignment — backend LLD §06.
 *
 * ORDER OF OPERATIONS MATTERS (Priority Engine §06):
 *
 *   doctor becomes free → pop highest-P case for that speciality
 *                       → score doctors eligible for THAT case → assign
 *
 * Case-first, not doctor-first. The alternative — for each idle doctor, pick
 * whichever case scores best against that doctor — would let a low-priority
 * case jump ahead of a higher-priority one purely because it happens to match
 * an idle doctor's profile better, silently breaking the fairness guarantee the
 * priority engine exists to provide. Case selection is a pure function of the
 * queue (queueLane.peekNext); doctor selection runs only after the case is
 * already fixed.
 *
 * Scoring, from the LLD's table:
 *   Queue load       40%   max(0, 100 − queue_length × 10)
 *   Speciality match 30%   exact 100 · general 70 · other 30
 *   Efficiency       20%   100 − (avg_consult_min × 2)
 *   Rating           10%   doctor_rating × 20
 *
 * (The LLD's worked example prints totals that don't reproduce from its own
 * weights — 80/100/76/96 is shown as 87.6 where the weighted sum is 86.8. The
 * weights are the normative part and are what run here; they're config, so a
 * different intended calibration is a config change, not a code change.)
 */

const queueLoadScore = (load) => Math.max(0, 100 - load * 10);

const efficiencyScore = (avgConsultMin) => {
  const value = Number.isFinite(Number(avgConsultMin))
    ? Number(avgConsultMin)
    : config.queue.defaultConsultSeconds / 60;
  return Math.max(0, Math.min(100, 100 - value * 2));
};

const ratingScore = (rating) => {
  const value = Number.isFinite(Number(rating)) ? Number(rating) : config.queue.defaultDoctorRating;
  return Math.max(0, Math.min(100, value * 20));
};

const specScore = (level, cfg) => {
  if (level === SPEC_MATCH.EXACT) return cfg.doctorAssignment.specMatchValues.EXACT;
  if (level === SPEC_MATCH.GENERAL) return cfg.doctorAssignment.specMatchValues.GENERAL;
  return cfg.doctorAssignment.specMatchValues.OTHER;
};

/**
 * Eligibility runs first, before any scoring (LLD §06):
 *   online now · on shift · speciality matches or is general.
 * A doctor who fails any of these is never scored, so no weighting can let
 * them through.
 */
const eligibleDoctors = async (entry) => {
  const online = await doctorStatus.listAvailable(entry.speciality);

  const checked = await Promise.all(
    online.map(async (doctor) => {
      const level = matchLevel(entry.speciality, doctor.speciality);
      if (level === SPEC_MATCH.NONE) return null;
      const onShift = await doctorStatus.isOnShift(doctor.doctorUuid);
      if (!onShift) return null;
      return { doctor, specMatch: level };
    })
  );

  return checked.filter(Boolean);
};

const scoreDoctors = async (entry, candidates) => {
  const cfg = priorityConfig.get();
  const weights = cfg.doctorAssignment.weights;

  const uuids = candidates.map((c) => c.doctor.doctorUuid);
  const stats = uuids.length
    ? await models.doctor_service_stats.findAll({ where: { doctorUuid: uuids } })
    : [];
  const statsByUuid = new Map(stats.map((s) => [s.doctorUuid, s]));

  const scored = await Promise.all(
    candidates.map(async ({ doctor, specMatch }) => {
      const stat = statsByUuid.get(doctor.doctorUuid);
      const load = await doctorStatus.currentLoad(doctor.doctorUuid);

      const components = {
        queueLoad: queueLoadScore(load),
        specMatch: specScore(specMatch, cfg),
        efficiency: efficiencyScore(stat?.avgConsultMin),
        rating: ratingScore(stat?.rating),
      };

      const total =
        weights.queueLoad * components.queueLoad +
        weights.specMatch * components.specMatch +
        weights.efficiency * components.efficiency +
        weights.rating * components.rating;

      return {
        doctorUuid: doctor.doctorUuid,
        speciality: doctor.speciality,
        specMatch,
        queueLength: load,
        components,
        total: Number(total.toFixed(2)),
      };
    })
  );

  return scored.sort((a, b) => b.total - a.total || a.doctorUuid.localeCompare(b.doctorUuid));
};

/**
 * The free doctor who should get this case, or null when nobody is eligible.
 * Returns the full ranking too — the analytics view and any future "why this
 * doctor?" audit both want it.
 */
const selectDoctorFor = async (entry) => {
  const candidates = await eligibleDoctors(entry);
  if (!candidates.length) return { doctor: null, ranking: [] };
  const ranking = await scoreDoctors(entry, candidates);
  return { doctor: ranking[0] || null, ranking };
};

module.exports = {
  selectDoctorFor,
  eligibleDoctors,
  scoreDoctors,
  queueLoadScore,
  efficiencyScore,
  ratingScore,
};
