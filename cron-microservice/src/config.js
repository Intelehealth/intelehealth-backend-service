const parseBoolean = (value, fallback = false) => {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const parseJsonArray = (value, fallback) => {
  if (!value) return fallback;
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
  return parsed;
};

const numberFromEnv = (value, fallback) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Invalid numeric configuration: ${value}`);
  return parsed;
};

module.exports = { parseBoolean, parseJsonArray, numberFromEnv };
