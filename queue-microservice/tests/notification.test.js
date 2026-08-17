const test = require("node:test");
const assert = require("node:assert/strict");

const notification = require("../src/services/notification.service");
const config = require("../src/config/env");
const { NOTIFICATION_TIER } = require("../src/constants");

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
 * should tell the patient." Plus a frequency cap that applies independently of
 * the threshold.
 */
test("EWT only pushes when the change is worth telling someone about", () => {
  const now = Date.now();
  const long_ago = new Date(now - 10 * 60000);

  // Nothing pushed yet — the first estimate always goes out.
  assert.equal(notification.shouldPushEwt({ lastEwtPushed: null }, 30, now), true);

  // Below the 5-minute threshold: silent.
  assert.equal(
    notification.shouldPushEwt({ lastEwtPushed: 30, lastPushAt: long_ago }, 34, now),
    false
  );
  assert.equal(
    notification.shouldPushEwt({ lastEwtPushed: 30, lastPushAt: long_ago }, 35, now),
    false
  );

  // Over the threshold, in either direction.
  assert.equal(
    notification.shouldPushEwt({ lastEwtPushed: 30, lastPushAt: long_ago }, 36, now),
    true
  );
  assert.equal(
    notification.shouldPushEwt({ lastEwtPushed: 30, lastPushAt: long_ago }, 20, now),
    true
  );
});

test("the frequency cap defers a push that clears the threshold but comes too soon", () => {
  const now = Date.now();
  const justNow = new Date(now - config.notification.ewtMinIntervalMs / 2);

  assert.equal(notification.shouldPushEwt({ lastEwtPushed: 30, lastPushAt: justNow }, 60, now), false);

  const older = new Date(now - config.notification.ewtMinIntervalMs - 1000);
  assert.equal(notification.shouldPushEwt({ lastEwtPushed: 30, lastPushAt: older }, 60, now), true);
});

test("a non-numeric estimate is never pushed", () => {
  const now = Date.now();
  assert.equal(notification.shouldPushEwt({ lastEwtPushed: 10 }, NaN, now), false);
  assert.equal(notification.shouldPushEwt({ lastEwtPushed: 10 }, null, now), false);
});
