const test = require("node:test");
const assert = require("node:assert/strict");

const eta = require("../src/services/eta.service");
const config = require("../src/config/env");

/**
 * The ETA anchor.
 *
 * The estimate is exposed as an absolute instant (`etaAt`) so a mobile client
 * can render a live countdown locally instead of needing a push every minute.
 * That only works if the instant holds still while nothing changes — which is
 * why the re-anchor decision is made on the model's computed WAIT, never on the
 * instant itself. Comparing instants would see `now + 30min` slide forward on
 * every call and the promised time would recede forever.
 */
const TOLERANCE = config.eta.anchorToleranceMin;
const anchorOf = (waitMin, at) => new Date(at.getTime() + waitMin * 60000);

test("the first estimate establishes the anchor", () => {
  const now = new Date();
  const { etaAt, moved } = eta.resolveAnchor({}, 30, { now });
  assert.equal(moved, true);
  assert.equal(etaAt.getTime(), now.getTime() + 30 * 60000);
});

/**
 * THE property this whole mechanism exists for. Nothing in the queue changes
 * while the patient waits; the promised time must not budge, so the countdown
 * actually counts down.
 */
test("an unchanged wait holds the anchor still — the horizon does not recede", () => {
  const T0 = new Date();
  const anchor = anchorOf(30, T0);

  for (const elapsed of [1, 5, 10, 20, 29]) {
    const now = new Date(T0.getTime() + elapsed * 60000);
    // Position has not moved, so the model still computes 30 minutes.
    const { etaAt, moved } = eta.resolveAnchor(
      { storedEtaAt: anchor, storedWaitMin: 30 },
      30,
      { now }
    );
    assert.equal(moved, false, `anchor moved after ${elapsed} min of waiting`);
    assert.equal(etaAt.getTime(), anchor.getTime());
    assert.equal(eta.minutesUntil(etaAt, now), 30 - elapsed, `remaining at +${elapsed}min`);
  }
});

test("jitter in the computed wait, inside tolerance, does not disturb the anchor", () => {
  const T0 = new Date();
  const anchor = anchorOf(30, T0);

  for (const wait of [30, 30 + TOLERANCE, 30 - TOLERANCE, 31, 29]) {
    const { moved, etaAt } = eta.resolveAnchor(
      { storedEtaAt: anchor, storedWaitMin: 30 },
      wait,
      { now: new Date(T0.getTime() + 60000) }
    );
    assert.equal(moved, false, `wait of ${wait} should not re-anchor`);
    assert.equal(etaAt.getTime(), anchor.getTime());
  }
});

test("a real change in the wait re-anchors — someone ahead was served", () => {
  const T0 = new Date();
  const anchor = anchorOf(30, T0);
  const now = new Date(T0.getTime() + 5 * 60000);

  // Position dropped, the model now says 12 minutes.
  const { etaAt, moved, changedByMin } = eta.resolveAnchor(
    { storedEtaAt: anchor, storedWaitMin: 30 },
    12,
    { now }
  );
  assert.equal(moved, true);
  assert.equal(changedByMin, 18);
  assert.equal(etaAt.getTime(), now.getTime() + 12 * 60000);
  assert.equal(eta.minutesUntil(etaAt, now), 12);
});

test("a corrupt or partial stored anchor is replaced, not propagated", () => {
  const now = new Date();
  for (const stored of [
    { storedEtaAt: "not-a-date", storedWaitMin: 30 },
    { storedEtaAt: anchorOf(30, now), storedWaitMin: null },
    {},
  ]) {
    const { moved, etaAt } = eta.resolveAnchor(stored, 20, { now });
    assert.equal(moved, true, JSON.stringify(stored));
    assert.equal(etaAt.getTime(), now.getTime() + 20 * 60000);
  }
});

test("a non-finite fresh wait leaves the stored anchor alone", () => {
  const anchor = anchorOf(30, new Date());
  for (const bad of [null, undefined, NaN]) {
    const { etaAt, moved } = eta.resolveAnchor(
      { storedEtaAt: anchor, storedWaitMin: 30 },
      bad
    );
    assert.equal(moved, false);
    assert.equal(etaAt.getTime(), anchor.getTime());
  }
});

test("minutesUntil counts DOWN as time passes — the client-side behaviour", () => {
  const T0 = new Date();
  const anchor = anchorOf(30, T0);
  const readings = [0, 5, 10, 20, 29].map((e) =>
    eta.minutesUntil(anchor, new Date(T0.getTime() + e * 60000))
  );

  assert.deepEqual(readings, [30, 25, 20, 10, 1]);
  for (let i = 1; i < readings.length; i += 1) {
    assert.ok(readings[i] < readings[i - 1], "remaining minutes must strictly decrease");
  }
});

test("an overdue anchor reads as 0 remaining, never negative", () => {
  const past = new Date(Date.now() - 15 * 60000);
  assert.equal(eta.minutesUntil(past), 0);
  assert.equal(eta.isOverdue(past), true);
  assert.equal(eta.isOverdue(new Date(Date.now() + 15 * 60000)), false);
});

test("a missing or unparseable anchor yields null, not NaN", () => {
  for (const bad of [null, undefined, "", "nonsense"]) {
    assert.equal(eta.minutesUntil(bad), null, `minutesUntil(${String(bad)})`);
  }
  assert.equal(eta.isOverdue(null), false);
});
