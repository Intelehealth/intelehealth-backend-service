const config = require("../config/env");
const { TooManyRequestsError } = require("../utils/errors");

/**
 * Backend LLD §13.2 — "stopping one bad app from flooding the queue".
 *
 * A buggy or malicious client hammering /submit or /heartbeat could fill the
 * queue with junk or just overload the server. A handful of submits per health
 * worker per minute is plenty for real use and stops an accidental retry loop
 * from doing damage.
 *
 * Deliberately in-process and dependency-free: it protects a single node from
 * a runaway client, which is what the doc asks for. If QMS is ever run behind a
 * load balancer with more than one instance, move this to a shared store.
 */
const buckets = new Map();

const prune = (now) => {
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > config.rateLimit.windowMs * 2) buckets.delete(key);
  }
};

let lastPrune = 0;

const rateLimit = (name, maxPerWindow) => (req, _res, next) => {
  if (!config.rateLimit.enabled) return next();

  const now = Date.now();
  if (now - lastPrune > config.rateLimit.windowMs) {
    prune(now);
    lastPrune = now;
  }

  // Key on the acting user, not the IP — many health workers share a network.
  const identity =
    req.auth?.userUuid || req.body?.hwUserUuid || req.ip || "anonymous";
  const key = `${name}:${identity}`;

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= config.rateLimit.windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > maxPerWindow) {
    const retryAfterSec = Math.ceil((bucket.start + config.rateLimit.windowMs - now) / 1000);
    return next(
      new TooManyRequestsError(
        `Too many ${name} requests — limit is ${maxPerWindow} per minute`,
        "RATE_LIMITED",
        { retryAfterSeconds: Math.max(retryAfterSec, 1) }
      )
    );
  }

  return next();
};

const submitLimiter = () => rateLimit("submit", config.rateLimit.submitPerMinute);
const heartbeatLimiter = () => rateLimit("heartbeat", config.rateLimit.heartbeatPerMinute);

/** Test hook — clears all counters. */
const reset = () => buckets.clear();

module.exports = { rateLimit, submitLimiter, heartbeatLimiter, reset };
