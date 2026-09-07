const config = require("../config/env");
const logger = require("../utils/logger");
const queueLane = require("./queueLane.service");
const etaService = require("./eta.service");
const pushService = require("./push.service");
const recipients = require("./recipients.service");
const messages = require("./notificationMessages");
const doctorStatus = require("./doctorStatus.service");
const { NOTIFICATION_TIER, WAITING_STATUSES } = require("../constants");
const { EVENT } = require("../constants/events");
const { describeError } = require("../utils/errors");

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
 * implemented here exactly as specified; what they gate is an FCM / web push
 * sent the way portal sends one, plus the silent write that the
 * GET /api/queue/:id/status poll then serves. Tier 4 ("pull on demand") is the
 * poll endpoint, which is also the resync path after any connectivity gap.
 *
 * ONE-SHOT EVENTS ARE NOT TIERED. The tiering damps *repeated* position churn
 * for a case that is already in the queue. Events that happen once per case —
 * queued, ready, escalated, cancelled, and the new-case announcement to
 * doctors — are sent immediately and are not affected by position.
 *
 * Pushes carry identifiers, position and ETA only — never chief complaint,
 * symptoms or vitals (§13.3).
 */

/** Only the top 30 positions are ever pushed; beyond that it is pull-only. */
const MAX_TRACKED_POSITION = 30;

const laneDebounce = new Map(); // laneKey → timer
const laneDirty = new Map(); // laneKey → scope
const deferredBatch = new Map(); // entryId → payload (tier 2, flushed every 10s)
const periodicBatch = new Map(); // entryId → payload (tier 3, flushed every ~75s)

let deferredTimer = null;
let periodicTimer = null;

const laneKey = (scope) => String(scope.speciality);

const resolveTier = (position) => {
  if (!Number.isFinite(position) || position < 1) return NOTIFICATION_TIER.PULL;
  if (position <= 3) return NOTIFICATION_TIER.IMMEDIATE;
  if (position <= 10) return NOTIFICATION_TIER.DEBOUNCED;
  if (position <= MAX_TRACKED_POSITION) return NOTIFICATION_TIER.BATCHED;
  return NOTIFICATION_TIER.PULL;
};

/**
 * Who a given notification is for. Doctor-addressed payloads carry an explicit
 * `doctorUuid`; everything else goes to the health worker who submitted.
 */
const recipientOf = (payload) => payload.doctorUuid || payload.hwUserUuid || null;

/**
 * Deliver straight to devices, exactly as portal does: FCM through
 * firebase-admin for the mobile apps, web push through VAPID for the browser.
 *
 * Tokens come from portal's own `user_settings.device_reg_token` and
 * `pushnotification.notification_object`, so a device already registered for
 * portal notifications receives these with no client-side change.
 *
 * Every failure is swallowed and logged — a notification must never be able to
 * break a queue operation.
 */
const deliver = async (payloads) => {
  if (!payloads.length) return;
  if (!config.notification.enabled) return;

  try {
    const byUser = new Map();
    for (const payload of payloads) {
      const uuid = recipientOf(payload);
      if (!uuid) {
        logger.debug("Notification has no recipient — skipped", { event: payload.event });
        continue;
      }
      if (!byUser.has(uuid)) byUser.set(uuid, []);
      byUser.get(uuid).push(payload);
    }
    if (!byUser.size) return;

    const resolved = await recipients.forUsers([...byUser.keys()]);

    for (const [uuid, list] of byUser) {
      const target = resolved.get(uuid);
      if (!target) {
        logger.debug("No registered device for user — nothing pushed", { count: list.length });
        continue;
      }
      if (config.push.respectSnooze && target.snoozed) {
        logger.debug("User is snoozed — notification withheld", { count: list.length });
        continue;
      }

      for (const payload of list) {
        const { title, body } = messages.build(payload, target.locale);
        const data = messages.toDataPayload(payload);

        if (target.tokens.length) {
          await pushService.sendCloudNotification({
            data,
            notification: { title, body },
            regTokens: target.tokens,
          });
        }

        if (config.push.webPushEnabled && target.webpushSubs.length) {
          for (const subscription of target.webpushSubs) {
            await pushService.sendWebPushNotification({
              webpush_obj: subscription,
              title,
              body,
              data,
              parse: typeof subscription === "string",
            });
          }
        }
      }
    }
  } catch (err) {
    // Nothing here is allowed to reach the caller: a notification must never
    // be able to break a queue operation.
    logger.warn("Notification delivery failed", { error: describeError(err), count: payloads.length });
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
 * §08.2 — the ETA push threshold, judged on the anchored instant.
 *
 * "A 1-minute shift is noise. A 5+ minute shift changes what the HW should tell
 * the patient." Since clients count down locally, they do not need to hear that
 * a minute passed — only that the promised TIME moved. A queue that shuffles
 * without changing when this patient will be seen produces no push at all.
 *
 * Plus a frequency cap that applies independently of the threshold.
 */
const shouldPushEtaAt = (entry, newEtaAt, now) => {
  if (!newEtaAt) return false;
  const last = entry.lastEtaAtPushed;
  if (!last) return true;

  const shiftMinutes = Math.abs(new Date(newEtaAt).getTime() - new Date(last).getTime()) / 60000;
  if (shiftMinutes <= config.notification.ewtDeltaMinutes) return false;
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

  // Keep the promised instant stable unless the computed wait genuinely moved.
  const anchor = etaService.resolveAnchor(
    { storedEtaAt: entry.etaAt, storedWaitMin: entry.estimatedWaitMin },
    etaMinutes
  );

  const patch = { estimatedWaitMin: etaMinutes, etaModelUsed: model };
  if (anchor.moved) patch.etaAt = anchor.etaAt;

  const positionChanged = entry.lastPositionPushed !== position;
  const wantsEwtPush = shouldPushEtaAt(entry, anchor.etaAt, now);

  let payload = null;
  const pushNow = force || tier === NOTIFICATION_TIER.IMMEDIATE;

  if ((pushNow || tier === NOTIFICATION_TIER.DEBOUNCED || tier === NOTIFICATION_TIER.BATCHED) &&
      (positionChanged || wantsEwtPush)) {
    payload = basePayload(entry, EVENT.POSITION, {
      position,
      tier,
      // Always carry the instant: it is what the client renders a countdown
      // from, and it costs nothing to include.
      etaAt: anchor.etaAt ? new Date(anchor.etaAt).toISOString() : null,
      etaMinutes: etaService.minutesUntil(anchor.etaAt),
    });
  }

  if (payload) {
    patch.lastPositionPushed = position;
    if (wantsEwtPush) patch.lastEtaAtPushed = anchor.etaAt;
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

/**
 * The health worker's confirmation that the visit is in the queue.
 *
 * Sent once on submit, immediately, outside the §08 position tiering — the
 * tiering exists to damp *repeated* position churn, and this is a one-shot
 * acknowledgement that the upload actually landed somewhere.
 */
const notifyCaseQueued = (entry, { position = null, etaAt = null } = {}) =>
  pushImmediate(entry, EVENT.QUEUED, {
    position,
    etaAt: etaAt ? new Date(etaAt).toISOString() : null,
    etaMinutes: etaService.minutesUntil(etaAt),
  });

/**
 * Announce a new case to every doctor in the speciality.
 *
 * One push each, addressed individually, so each doctor's own device token and
 * locale are used. The doctor a case was auto-assigned to is skipped — they get
 * the case itself, not an advert for it.
 *
 * Sent once per case. It is not on the tiering path and does not repeat as the
 * queue shuffles, so a busy queue cannot turn into a stream of doctor pushes.
 */
const notifyDoctorsOfNewCase = async (entry, { excludeDoctorUuid = null, waiting = null } = {}) => {
  if (!config.notification.notifyDoctorsOnNewCase) return 0;

  let doctorUuids = [];
  try {
    doctorUuids = await doctorStatus.listBySpeciality(entry.speciality);
  } catch (err) {
    logger.warn("Could not list doctors for new-case announcement", { error: describeError(err) });
    return 0;
  }

  const targets = doctorUuids.filter((uuid) => uuid && uuid !== excludeDoctorUuid);
  if (!targets.length) {
    logger.debug("No doctors registered for speciality — new case not announced", {
      speciality: entry.speciality,
    });
    return 0;
  }

  await deliver(
    targets.map((doctorUuid) => ({
      event: EVENT.NEW_CASE,
      doctorUuid,
      queueEntryId: entry.id,
      visitUuid: entry.visitUuid,
      speciality: entry.speciality,
      emergencyLevel: entry.emergencyLevel,
      caseType: entry.caseType,
      status: entry.status,
      escalated: entry.escalatedAt !== null,
      ...(Number.isFinite(waiting) ? { waiting } : {}),
    }))
  );

  logger.info("New case announced to doctors", {
    queueEntryId: entry.id,
    speciality: entry.speciality,
    doctors: targets.length,
  });
  return targets.length;
};

const notifyReady = (entry, extra) => pushImmediate(entry, EVENT.READY, extra);
const notifyEscalated = (entry, extra) => pushImmediate(entry, EVENT.ESCALATED, extra);
const notifyCancelled = (entry, reason) => pushImmediate(entry, EVENT.CANCELLED, { reason });

/**
 * Doctor panel refresh — LLD §10's doctor:queue_update, delivered as a push.
 * `doctorUuid` is what makes it addressable: without it there is no device to
 * send to and the notification is dropped.
 */
const notifyDoctorPanel = async (speciality, cases, doctorUuid = null) => {
  await deliver([{ event: EVENT.DOCTOR_QUEUE_UPDATE, speciality, cases, doctorUuid }]);
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
  recipientOf,
  resolveTier,
  shouldPushEtaAt,
  scheduleLaneUpdate,
  flushLane,
  flushDeferred,
  flushPeriodic,
  refreshEntry,
  notifyCaseQueued,
  notifyDoctorsOfNewCase,
  notifyReady,
  notifyEscalated,
  notifyCancelled,
  notifyDoctorPanel,
  shutdown,
};
