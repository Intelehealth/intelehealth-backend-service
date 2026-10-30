"use strict";
const path = require("path");

const portalRoot = path.join(__dirname, "..", "..");

/**
 * Put a fake in the require cache for a portal file (path relative to portal/), so a module that
 * would open a database or read a key file can be required in a test. Returns a function that puts
 * the cache back as it was.
 * @param {string} relativePath - for example "middleware/auth"
 * @param {*} exports
 */
const stubModule = (relativePath, exports) => {
  const resolved = require.resolve(path.join(portalRoot, relativePath));
  const previous = require.cache[resolved];
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
  return () => {
    if (previous) require.cache[resolved] = previous;
    else delete require.cache[resolved];
  };
};

/**
 * Forget a portal file so the next require loads it again.
 * @param {string} relativePath
 */
const forget = (relativePath) => {
  delete require.cache[require.resolve(path.join(portalRoot, relativePath))];
};

/**
 * A response object that records what a controller sent.
 */
const fakeResponse = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

module.exports = { stubModule, forget, fakeResponse, portalRoot };
