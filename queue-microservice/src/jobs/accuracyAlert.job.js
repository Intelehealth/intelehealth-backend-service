const config = require("../config/env");
const logger = require("../utils/logger");
const analytics = require("../services/analytics.service");

/**
 * Wait-time accuracy alerting — backend LLD §13.4.
 *
 * "§09.4 gives you a live accuracy number, but nothing today actually watches
 * it. If the wait-time estimate drifts badly — say, error stays above 90
 * minutes for half an hour — page whoever's on call, the same way you'd page
 * someone for a server outage. Nobody should have to remember to check a
 * dashboard."
 *
 * The doc also settles what this is allowed to be: ops alerting only, the same
 * role PagerDuty already plays for engineers. It is never patient-facing and
 * the payload carries no patient data — a speciality name and a number.
 */
let breachStartedAt = null;
let alerted = false;

const send = async (payload) => {
  if (!config.accuracyAlert.webhookUrl) {
    logger.error("QMS accuracy alert (no webhook configured)", payload);
    return;
  }
  try {
    const res = await fetch(config.accuracyAlert.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) logger.error("Accuracy alert webhook rejected", { status: res.status });
  } catch (err) {
    logger.error("Accuracy alert webhook failed", { error: err.message });
  }
};

const runAccuracyTick = async ({ now = new Date() } = {}) => {
  if (!config.accuracyAlert.enabled) return { skipped: true };

  const summary = await analytics.currentMae(config.accuracyAlert.lookbackMin);

  if (!summary.samples || summary.samples < config.accuracyAlert.minSamples) {
    return { samples: summary.samples || 0, belowMinSamples: true };
  }

  const breaching = summary.maeMin > config.accuracyAlert.maeThresholdMin;

  if (!breaching) {
    if (alerted) {
      await send({
        event: "qms.eta_accuracy.recovered",
        severity: "info",
        maeMin: summary.maeMin,
        thresholdMin: config.accuracyAlert.maeThresholdMin,
      });
    }
    breachStartedAt = null;
    alerted = false;
    return { maeMin: summary.maeMin, breaching: false };
  }

  if (!breachStartedAt) breachStartedAt = now;
  const sustainedMin = (now - breachStartedAt) / 60000;

  if (!alerted && sustainedMin >= config.accuracyAlert.sustainedForMin) {
    alerted = true;
    await send({
      event: "qms.eta_accuracy.degraded",
      severity: "error",
      // Ops numbers only — no patient, visit or health-worker identifiers.
      maeMin: summary.maeMin,
      biasMin: summary.biasMin,
      within30Pct: summary.within30Pct,
      samples: summary.samples,
      thresholdMin: config.accuracyAlert.maeThresholdMin,
      sustainedMin: Math.round(sustainedMin),
      hint: "Re-check §07's calibration: eta_model_used per speciality and the per-speciality overhead constant.",
    });
    logger.error("ETA accuracy degraded — on-call paged", {
      maeMin: summary.maeMin,
      sustainedMin: Math.round(sustainedMin),
    });
  }

  return { maeMin: summary.maeMin, breaching: true, sustainedMin: Math.round(sustainedMin), alerted };
};

/** Test hook. */
const reset = () => {
  breachStartedAt = null;
  alerted = false;
};

module.exports = { runAccuracyTick, reset };
