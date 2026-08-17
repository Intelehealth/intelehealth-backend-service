const config = require("../config/env");
const logger = require("../utils/logger");
const queueLane = require("./queueLane.service");
const etaService = require("./eta.service");
const { NOTIFICATION_TIER, WAITING_STATUSES } = require("../constants");

/**
 * Real-time notification strategy — backend LLD §08.
 *
 * "Not every position change deserves a push. A HW at position 1–3 needs to
 * know immediately; a HW at position 40 does not need nine WebSocket messages
 * while they're nowhere close to being called."
 *
 *   1 – 3    immediate push                  accuracy critical
 *   4 – 10   debounced push, within 10s      useful soon
 *   11 – 30  periodic batch, every 60–90s    no urgency
 *   31 +     pull on demand                  irrelevant for a long time
 *
 * A priority insertion therefore triggers at most 3 immediate pushes, never 30.
 *
 * TRANSPORT NOTE — this service has no socket server. §08's tiering, 500ms
 * debounce, 5-minute EWT threshold and 30-second frequency cap are all
 * implemented here exactly as specified; what they gate is an outbound push
 * (FCM via the configured webhook) plus the silent write that the
 * GET /api/queue/:id/status poll then serves. Tier 4 ("pull on demand") is the
 * poll endpoint, which is also the resync path after any connectivity gap.
 *
 * Pushes carry identifiers, position and ETA only — never chief complaint,
 * symptoms or vitals (§13.3).
 */

const EVENT = {
  POSITION: "queue:position",
  EWT: "queue:ewt",
  READY: "queue:ready",
  ESCALATED: "queue:escalated",
  CANCELLED: "queue:cancelled",
  DOCTOR_QUEUE_UPDATE: "doctor:queue_update",
};

/** Only the top 30 positions are ever pushed; beyond that it is pull-only. */
const MAX_TRACKED_POSITION = 30;

const laneDebounce = new Map(); // laneKey → timer
const laneDirty = new Map(); // laneKey → scope
const deferredBatch = new Map(); // entryId → payload (tier 2, flushed every 10s)
const periodicBatch = new Map(); // entryId → payload (tier 3, flushed every ~75s)

let deferredTimer = null;
let periodicTimer = null;

const laneKey = (scope) =>
  config.queue.scope === "SPECIALITY_LOCATION"
    ? `${scope.speciality}::${scope.locationUuid || ""}`
    : String(scope.speciality);

const resolveTier = (position) => {
  if (!Number.isFinite(position) || position < 1) return NOTIFICATION_TIER.PULL;
  if (position <= 3) return NOTIFICATION_TIER.IMMEDIATE;
  if (position <= 10) return NOTIFICATION_TIER.DEBOUNCED;
  if (position <= MAX_TRACKED_POSITION) return NOTIFICATION_TIER.BATCHED;
  return NOTIFICATION_TIER.PULL;
};

/**
 * Outbound delivery. Fire-and-forget by design: a notification failure must
 * never break a queue operation.
 */
const deliver = async (payloads) => {
  if (!payloads.length) return;
  if (!config.notification.enabled) return;

  if (!config.notification.webhookUrl) {
    logger.debug("Notification (no webhook configured)", {
      count: payloads.length,
      events: payloads.map((p) => `${p.event}#${p.queueEntryId}`),
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.notification.webhookTimeoutMs);
  try {
    const res = await fetch(config.notification.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.notification.webhookSecret
          ? { "x-qms-secret": config.notification.webhookSecret }
          : {}),
      },
      body: JSON.stringify({ source: "qms", notifications: payloads }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn("Notification webhook rejected the batch", {
        status: res.status,
        count: payloads.length,
      });
    }
  } catch (err) {
    logger.warn("Notification webhook failed", { error: err.message, count: payloads.length });
  } finally {
    clearTimeout(timeout);
  }
};

const basePayload = (entry, event, extra = {}) => ({
  event,
  queueEntryId: entry.id,
  visitUuid: entry.visitUuid,
  hwUserUuid: entry.hwUserUuid,
  speciality: entry.speciality,
  status: entry.status,
  ...extra,
});

/**
 * §08.2 — EWT push threshold.
 *
 * "Every position shift nudges wait time by roughly one consultation cycle.
 * Pushing a fresh EWT on every single shift is expensive and mostly noise. A
 * 1-minute shift is noise. A 5+ minute shift changes what the HW should tell
 * the patient."
 *
 * Plus a frequency cap that applies independently of the threshold.
 */
const shouldPushEwt = (entry, newEwt, now) => {
  if (!Number.isFinite(newEwt)) return false;
  const last = entry.lastEwtPushed;
  if (last === null || last === undefined) return true;
  if (Math.abs(newEwt - last) <= config.notification.ewtDeltaMinutes) return false;
  if (entry.lastPushAt && now - new Date(entry.lastPushAt).getTime() < config.notification.ewtMinIntervalMs) {
    return false; // defer to the next cycle
  }
  return true;
};

/**
 * Recompute one entry's position and ETA, persist them, and decide what (if
 * anything) gets pushed. Silent updates still write, so the poll endpoint and
 * the analytics view stay current for the tiers that never push.
 */
const refreshEntry = async (entry, { force = false } = {}) => {
  const position = await queueLane.getPosition(entry);
  if (position === null) return null;

  const { etaMinutes, model } = await etaService.estimate(entry, { position });
  const now = Date.now();
  const tier = resolveTier(position);

  const patch = { estimatedWaitMin: etaMinutes, etaModelUsed: model };
  const positionChanged = entry.lastPositionPushed !== position;
  const wantsEwtPush = shouldPushEwt(entry, etaMinutes, now);

  let payload = null;
  const pushNow = force || tier === NOTIFICATION_TIER.IMMEDIATE;

  if ((pushNow || tier === NOTIFICATION_TIER.DEBOUNCED || tier === NOTIFICATION_TIER.BATCHED) &&
      (positionChanged || wantsEwtPush)) {
    payload = basePayload(entry, EVENT.POSITION, {
      position,
      tier,
      ...(wantsEwtPush ? { etaMinutes } : {}),
    });
  }

  if (payload) {
    patch.lastPositionPushed = position;
    if (wantsEwtPush) patch.lastEwtPushed = etaMinutes;
    // Only stamp lastPushAt when the payload actually goes out now; a batched
    // payload stamps it at flush time.
    if (pushNow) patch.lastPushAt = new Date(now);
  }

  await entry.update(patch);

  if (!payload) return null;
  if (pushNow) return { immediate: payload };
  if (tier === NOTIFICATION_TIER.DEBOUNCED) {
    deferredBatch.set(entry.id, payload);
    return null;
  }
  periodicBatch.set(entry.id, payload);
  return null;
};

const flushDeferred = async () => {
  if (!deferredBatch.size) return;
  const payloads = [...deferredBatch.values()];
  deferredBatch.clear();
  await deliver(payloads);
};

const flushPeriodic = async () => {
  if (!periodicBatch.size) return;
  const payloads = [...periodicBatch.values()];
  periodicBatch.clear();
  await deliver(payloads);
};

const ensureTimers = () => {
  if (!deferredTimer) {
    deferredTimer = setInterval(() => {
      flushDeferred().catch((err) => logger.warn("Deferred flush failed", { error: err.message }));
    }, config.notification.deferredBatchMs);
    deferredTimer.unref?.();
  }
  if (!periodicTimer) {
    periodicTimer = setInterval(() => {
      flushPeriodic().catch((err) => logger.warn("Periodic flush failed", { error: err.message }));
    }, config.notification.periodicBatchMs);
    periodicTimer.unref?.();
  }
};

/**
 * §08.3 — the complete flow, on any change to a lane.
 *
 * A change lands → 500ms debounce window collects everything else that lands
 * with it → positions 1–3 push immediately → 4–10 join the 10s deferred batch →
 * 11+ update silently and wait for their batch or a poll.
 */
const flushLane = async (scope) => {
  const { rows } = await queueLane.listLane(scope, { limit: MAX_TRACKED_POSITION });
  const immediate = [];

  for (const entry of rows) {
    if (!WAITING_STATUSES.includes(entry.status)) continue;
    try {
      const result = await refreshEntry(entry);
      if (result?.immediate) immediate.push(result.immediate);
    } catch (err) {
      logger.warn("Lane refresh failed for entry", { queueEntryId: entry.id, error: err.message });
    }
  }

  await deliver(immediate);
};

/**
 * §08.1 — debounce gate.
 *
 * "If several priority cases jump the queue within a couple of seconds, don't
 * fire a push per insertion — that's a WebSocket storm. Collapse them."
 * Another change inside the window resets the timer and batches both.
 */
const scheduleLaneUpdate = (scope) => {
  if (!scope?.speciality) return;
  ensureTimers();

  const key = laneKey(scope);
  laneDirty.set(key, scope);

  const existing = laneDebounce.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    laneDebounce.delete(key);
    const pendingScope = laneDirty.get(key);
    laneDirty.delete(key);
    flushLane(pendingScope).catch((err) =>
      logger.warn("Lane flush failed", { lane: key, error: err.message })
    );
  }, config.notification.debounceMs);
  timer.unref?.();

  laneDebounce.set(key, timer);
};

/**
 * Events that bypass the tiering entirely.
 *
 * §08: an ESCALATED event always pushes immediately regardless of tier — it's
 * rare enough, and important enough, that the tiering rules shouldn't suppress
 * it. Same for ready and cancelled: both are terminal for the HW's waiting
 * experience and there is nothing to debounce.
 */
const pushImmediate = async (entry, event, extra = {}) => {
  const payload = basePayload(entry, event, extra);
  await deliver([payload]);
  try {
    await entry.update({ lastPushAt: new Date() });
  } catch (err) {
    logger.debug("Could not stamp lastPushAt", { queueEntryId: entry.id });
  }
};

const notifyReady = (entry, extra) => pushImmediate(entry, EVENT.READY, extra);
const notifyEscalated = (entry, extra) => pushImmediate(entry, EVENT.ESCALATED, extra);
const notifyCancelled = (entry, reason) => pushImmediate(entry, EVENT.CANCELLED, { reason });

/** Doctor panel refresh — LLD §10's doctor:queue_update, delivered as a push. */
const notifyDoctorPanel = async (speciality, cases) => {
  await deliver([
    { event: EVENT.DOCTOR_QUEUE_UPDATE, speciality, cases },
  ]);
};

const shutdown = () => {
  for (const timer of laneDebounce.values()) clearTimeout(timer);
  laneDebounce.clear();
  laneDirty.clear();
  if (deferredTimer) clearInterval(deferredTimer);
  if (periodicTimer) clearInterval(periodicTimer);
  deferredTimer = null;
  periodicTimer = null;
};

module.exports = {
  EVENT,
  resolveTier,
  shouldPushEwt,
  scheduleLaneUpdate,
  flushLane,
  flushDeferred,
  flushPeriodic,
  refreshEntry,
  notifyReady,
  notifyEscalated,
  notifyCancelled,
  notifyDoctorPanel,
  shutdown,
};
