const test = require("node:test");
const assert = require("node:assert/strict");

const notification = require("../src/services/notification.service");
const config = require("../src/config/env");
const { NOTIFICATION_TIER } = require("../src/constants");
const { EVENT } = require("../src/constants/events");

/**
 * Backend LLD §08 — notification tiering, debounce gate and EWT threshold.
 *
 * The point of the tiering is bounded fan-out: "a priority insertion therefore
 * triggers at most 3 immediate pushes (positions 1–3), never 30."
 */

test("tier boundaries match the §08 table exactly", () => {
  const expected = [
    [1, NOTIFICATION_TIER.IMMEDIATE],
    [3, NOTIFICATION_TIER.IMMEDIATE],
    [4, NOTIFICATION_TIER.DEBOUNCED],
    [10, NOTIFICATION_TIER.DEBOUNCED],
    [11, NOTIFICATION_TIER.BATCHED],
    [30, NOTIFICATION_TIER.BATCHED],
    [31, NOTIFICATION_TIER.PULL],
    [400, NOTIFICATION_TIER.PULL],
  ];
  for (const [position, tier] of expected) {
    assert.equal(notification.resolveTier(position), tier, `position ${position}`);
  }
});

test("at most three positions ever push immediately", () => {
  const immediate = [];
  for (let position = 1; position <= 100; position += 1) {
    if (notification.resolveTier(position) === NOTIFICATION_TIER.IMMEDIATE) immediate.push(position);
  }
  assert.deepEqual(immediate, [1, 2, 3]);
});

test("a bad or missing position degrades to pull-only rather than pushing", () => {
  assert.equal(notification.resolveTier(0), NOTIFICATION_TIER.PULL);
  assert.equal(notification.resolveTier(-1), NOTIFICATION_TIER.PULL);
  assert.equal(notification.resolveTier(null), NOTIFICATION_TIER.PULL);
  assert.equal(notification.resolveTier(undefined), NOTIFICATION_TIER.PULL);
});

/**
 * §08.2 — "A 1-minute shift is noise. A 5+ minute shift changes what the HW
 * should tell the patient." Plus a frequency cap that applies independently.
 *
 * Judged on the anchored INSTANT rather than on a duration: clients count down
 * locally, so what matters is whether the promised time moved, not whether a
 * minute passed.
 */
const at = (minutesFromNow) => new Date(Date.now() + minutesFromNow * 60000);

test("an ETA push needs the promised time to have actually moved", () => {
  const now = Date.now();
  const longAgo = new Date(now - 10 * 60000);

  // Nothing pushed yet — the first estimate always goes out.
  assert.equal(notification.shouldPushEtaAt({ lastEtaAtPushed: null }, at(30), now), true);

  // The queue shuffled but this patient's time did not move: silent.
  const anchor = at(30);
  assert.equal(
    notification.shouldPushEtaAt({ lastEtaAtPushed: anchor, lastPushAt: longAgo }, anchor, now),
    false
  );
  const nudged = new Date(anchor.getTime() + 4 * 60000);
  assert.equal(
    notification.shouldPushEtaAt({ lastEtaAtPushed: anchor, lastPushAt: longAgo }, nudged, now),
    false,
    "a 4-minute shift is still noise"
  );

  // Over the threshold, in either direction.
  for (const shift of [6, -6, 30]) {
    const moved = new Date(anchor.getTime() + shift * 60000);
    assert.equal(
      notification.shouldPushEtaAt({ lastEtaAtPushed: anchor, lastPushAt: longAgo }, moved, now),
      true,
      `a ${shift}-minute shift should push`
    );
  }
});

test("the frequency cap defers a push that clears the threshold but comes too soon", () => {
  const now = Date.now();
  const anchor = at(30);
  const moved = new Date(anchor.getTime() + 20 * 60000);

  const justNow = new Date(now - config.notification.ewtMinIntervalMs / 2);
  assert.equal(
    notification.shouldPushEtaAt({ lastEtaAtPushed: anchor, lastPushAt: justNow }, moved, now),
    false
  );

  const older = new Date(now - config.notification.ewtMinIntervalMs - 1000);
  assert.equal(
    notification.shouldPushEtaAt({ lastEtaAtPushed: anchor, lastPushAt: older }, moved, now),
    true
  );
});

/**
 * Routing: who each notification is addressed to. Getting this wrong would
 * send a doctor's new-case announcement to the health worker's handset, or
 * vice versa.
 */
test("doctor-addressed payloads route to the doctor, not the health worker", () => {
  const announcement = {
    event: EVENT.NEW_CASE,
    doctorUuid: "doc-1",
    hwUserUuid: "hw-1", // present as metadata; must not win
    queueEntryId: 7,
  };
  assert.equal(notification.recipientOf(announcement), "doc-1");
});

test("health-worker payloads route to the submitting health worker", () => {
  for (const event of [EVENT.QUEUED, EVENT.POSITION, EVENT.READY, EVENT.ESCALATED, EVENT.CANCELLED]) {
    assert.equal(
      notification.recipientOf({ event, hwUserUuid: "hw-9", queueEntryId: 1 }),
      "hw-9",
      `${event} should go to the health worker`
    );
  }
});

test("a payload with nobody to send to resolves to null rather than guessing", () => {
  assert.equal(notification.recipientOf({ event: EVENT.NEW_CASE, queueEntryId: 1 }), null);
  assert.equal(notification.recipientOf({ event: EVENT.DOCTOR_QUEUE_UPDATE }), null);
});

test("an assigned case's doctor uuid does not hijack the health worker's push", () => {
  // queue:ready carries assignedDoctorUuid so the client can open the call —
  // it is not the recipient. Only `doctorUuid` addresses a doctor.
  const ready = {
    event: EVENT.READY,
    hwUserUuid: "hw-2",
    assignedDoctorUuid: "doc-5",
  };
  assert.equal(notification.recipientOf(ready), "hw-2");
});

test("a missing anchor is never pushed", () => {
  const now = Date.now();
  for (const bad of [null, undefined, ""]) {
    assert.equal(
      notification.shouldPushEtaAt({ lastEtaAtPushed: at(10) }, bad, now),
      false,
      `etaAt=${String(bad)}`
    );
  }
});
