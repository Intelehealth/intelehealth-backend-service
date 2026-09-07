// Must be set before src/config/env is first required.
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
  project_id: "test-project",
  client_email: "test@test-project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
});
process.env.FIREBASE_DB_URL = "https://test-project.firebaseio.com";
process.env.VAPID_MAILTO = "mailto:dev@intelehealth.org";
process.env.VAPID_PUBLIC_KEY = "test-public";
process.env.VAPID_PRIVATE_KEY = "test-private";

const test = require("node:test");
const assert = require("node:assert/strict");

/**
 * Delivery payload conformance with portal.
 *
 * The claim this file exists to pin down is that QMS sends the *same* thing
 * portal sends. Both SDKs are stubbed in the require cache before the service
 * loads them, so the exact object handed to `sendEachForMulticast` and to
 * `webpush.sendNotification` can be inspected without a Firebase project, a
 * network call, or a database.
 *
 * Reference — portal/handlers/helper.js:
 *   payload = { data, tokens: regTokens,
 *               android: { priority: 'high' },
 *               apns: { payload: { aps: { priority: 10 } } } }
 *   if (notification) payload.notification = notification
 *   messaging.sendEachForMulticast(payload)
 *
 *   webpush.sendNotification(sub, JSON.stringify({ title, body,
 *                                                  vibrate: [100,50,100], data }))
 */
const sentFcm = [];
const sentWebPush = [];
let initArgs = null;

const stub = (moduleName, exports) => {
  const resolved = require.resolve(moduleName);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

stub("firebase-admin", {
  apps: [],
  credential: { cert: (serviceAccount) => ({ __credential: serviceAccount }) },
  initializeApp(options, name) {
    initArgs = { options, name };
    const app = { name, options };
    this.apps.push(app);
    return app;
  },
  messaging: () => ({
    sendEachForMulticast: async (payload) => {
      sentFcm.push(payload);
      return {
        successCount: payload.tokens.length,
        failureCount: 0,
        responses: payload.tokens.map(() => ({ success: true })),
      };
    },
  }),
});

stub("web-push", {
  setVapidDetails: () => {},
  sendNotification: async (subscription, body) => {
    sentWebPush.push({ subscription, body });
    return { statusCode: 201 };
  },
});

const push = require("../src/services/push.service");

test("firebase is initialised the way portal initialises it", async () => {
  await push.sendCloudNotification({ regTokens: ["tok-1"], notification: { title: "t", body: "b" } });

  assert.ok(initArgs, "initializeApp was never called");
  assert.equal(initArgs.options.credential.__credential.project_id, "test-project");
  assert.equal(initArgs.options.databaseURL, "https://test-project.firebaseio.com");
  // Named app so a co-loaded firebase-admin default app is left untouched.
  assert.equal(initArgs.name, "qms");
});

test("the FCM payload matches portal's shape exactly", () => {
  const payload = sentFcm[0];

  assert.deepEqual(payload.android, { priority: "high" });
  assert.deepEqual(payload.apns, { payload: { aps: { priority: 10 } } });
  assert.deepEqual(payload.tokens, ["tok-1"]);
  assert.deepEqual(payload.notification, { title: "t", body: "b" });
  assert.ok("data" in payload);

  // No extra top-level keys beyond what portal sends.
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["android", "apns", "data", "notification", "tokens"].sort()
  );
});

test("the notification block is omitted when absent, as in portal", async () => {
  sentFcm.length = 0;
  await push.sendCloudNotification({ regTokens: ["tok-2"], data: { event: "queue:ready" } });

  assert.equal(sentFcm.length, 1);
  assert.ok(!("notification" in sentFcm[0]), "portal only sets notification when truthy");
  assert.deepEqual(sentFcm[0].data, { event: "queue:ready" });
});

test("multicast goes to every registered device in one call", async () => {
  sentFcm.length = 0;
  await push.sendCloudNotification({ regTokens: ["a", "b", "c"], notification: { title: "x", body: "y" } });

  assert.equal(sentFcm.length, 1, "one multicast, not one call per token");
  assert.deepEqual(sentFcm[0].tokens, ["a", "b", "c"]);
});

test("no tokens means no call at all", async () => {
  sentFcm.length = 0;
  const result = await push.sendCloudNotification({ regTokens: [] });
  assert.equal(result, null);
  assert.equal(sentFcm.length, 0);
});

test("the web push body matches portal's shape exactly", async () => {
  const subscription = JSON.stringify({ endpoint: "https://push.example/x", keys: {} });
  await push.sendWebPushNotification({
    webpush_obj: subscription,
    title: "Queue update",
    body: "You are number 2",
    data: { event: "queue:position" },
  });

  assert.equal(sentWebPush.length, 1);
  const parsed = JSON.parse(sentWebPush[0].body);
  assert.deepEqual(parsed.vibrate, [100, 50, 100]);
  assert.equal(parsed.title, "Queue update");
  assert.equal(parsed.body, "You are number 2");
  assert.deepEqual(parsed.data, { event: "queue:position" });
  assert.deepEqual(Object.keys(parsed).sort(), ["body", "data", "title", "vibrate"].sort());

  // A stringified subscription is parsed before it is handed to web-push.
  assert.equal(typeof sentWebPush[0].subscription, "object");
  assert.equal(sentWebPush[0].subscription.endpoint, "https://push.example/x");
});

test("status reports both transports as configured and ready", () => {
  const s = push.status();
  assert.equal(s.fcmConfigured, true);
  assert.equal(s.webPushConfigured, true);
  assert.equal(s.fcm, "ready");
  assert.equal(s.webPush, "ready");
});

test("a delivery failure returns null rather than throwing", async () => {
  const resolved = require.resolve("firebase-admin");
  const original = require.cache[resolved].exports.messaging;
  require.cache[resolved].exports.messaging = () => ({
    sendEachForMulticast: async () => {
      throw new Error("FCM unreachable");
    },
  });
  push.reset();

  const result = await push.sendCloudNotification({ regTokens: ["tok"], data: {} });
  assert.equal(result, null, "a push failure must never propagate to the caller");

  require.cache[resolved].exports.messaging = original;
  push.reset();
});
