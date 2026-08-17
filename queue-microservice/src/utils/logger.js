/**
 * Minimal structured logger. Deliberately dependency-free.
 *
 * Never log patient data: case payloads carry chief complaint, symptoms and
 * vitals (LLD §13.3). Log identifiers, not contents.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const active = LEVELS[(process.env.LOG_LEVEL || "info").toLowerCase()] ?? LEVELS.info;

const write = (level, message, meta) => {
  if (LEVELS[level] > active) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    svc: "qms",
    msg: message,
  };
  if (meta !== undefined) line.meta = meta instanceof Error ? { error: meta.message } : meta;
  const out = level === "error" || level === "warn" ? console.error : console.log;
  out(JSON.stringify(line));
};

module.exports = {
  error: (message, meta) => write("error", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  info: (message, meta) => write("info", message, meta),
  debug: (message, meta) => write("debug", message, meta),
};
