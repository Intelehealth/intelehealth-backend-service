const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");

const config = require("../src/config/env");

/**
 * auth-gateway issues { exp, iat, data: { sessionId, userId, name } } — the
 * user id is nested under `data`. Reading only top-level claims left
 * req.auth.userUuid null, so a doctor's own status change failed NOT_SELF.
 */

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const keyFile = path.join(os.tmpdir(), `qms-auth-test-${process.pid}.pem`);
fs.writeFileSync(keyFile, publicKey.export({ type: "spki", format: "pem" }));
config.auth.publicKeyPath = keyFile;
test.after(() => fs.rmSync(keyFile, { force: true }));

// Required after the key path is set: the middleware caches the key on first use.
const { authenticate } = require("../src/middleware/auth");

const sign = (payload, opts = {}) => jwt.sign(payload, privateKey, { algorithm: "RS256", ...opts });

const run = (token) => {
  const req = { headers: { authorization: `Bearer ${token}` } };
  let error = null;
  authenticate(req, null, (err) => {
    error = err || null;
  });
  return { req, error };
};

test("an auth-gateway token (userId under data) resolves the user", () => {
  const token = sign(
    { data: { sessionId: "s1", userId: "9eb2dd7c-93f5-4578-8031-de1fcef1ac68", name: "doctor1" } },
    { expiresIn: "1h" }
  );
  const { req, error } = run(token);
  assert.equal(error, null);
  assert.equal(req.auth.userUuid, "9eb2dd7c-93f5-4578-8031-de1fcef1ac68");
  assert.equal(req.auth.isAdmin, false);
});

test("top-level userId still works", () => {
  const { req, error } = run(sign({ userId: "doc-1" }, { expiresIn: "1h" }));
  assert.equal(error, null);
  assert.equal(req.auth.userUuid, "doc-1");
});

test("an expired token says TOKEN_EXPIRED, not just invalid", () => {
  const past = Math.floor(Date.now() / 1000) - 3600;
  const { error } = run(sign({ data: { userId: "doc-1" }, iat: past - 60, exp: past }));
  assert.equal(error.status, 401);
  assert.equal(error.code, "TOKEN_EXPIRED");
});

test("a token signed with another key is INVALID_TOKEN", () => {
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const token = jwt.sign({ data: { userId: "doc-1" } }, other, { algorithm: "RS256", expiresIn: "1h" });
  const { error } = run(token);
  assert.equal(error.code, "INVALID_TOKEN");
});
