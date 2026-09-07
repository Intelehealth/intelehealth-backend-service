const config = require("../config/env");
const logger = require("../utils/logger");

/**
 * FCM and web-push delivery — the same mechanism portal uses.
 *
 * Deliberately a mirror of portal/handlers/helper.js:
 *   • firebase-admin initialised from FIREBASE_SERVICE_ACCOUNT_KEY (a JSON
 *     string) and FIREBASE_DB_URL,
 *   • `messaging.sendEachForMulticast` with the identical payload shape —
 *     android.priority 'high', apns aps.priority 10, optional `notification`
 *     block, `tokens` array,
 *   • web-push with the same VAPID triple and the same
 *     `{ title, body, vibrate: [100,50,100], data }` body.
 *
 * A device already registered for portal notifications therefore receives QMS
 * notifications with no client-side change: same credentials, same project,
 * same payload contract.
 *
 * ONE DELIBERATE DIFFERENCE — initialisation is lazy and non-fatal.
 * Portal calls `admin.initializeApp(...)` at module load, so a missing or
 * malformed credential takes the process down at require time. QMS must be able
 * to run a queue without Firebase configured (dev, CI, a deployment that only
 * wants the REST API), so setup happens on first send and a failure disables
 * push with a warning instead of crashing the service. Notification delivery
 * must never be able to break a queue operation.
 */

let admin = null;
let webpush = null;
let messaging = null;

let fcmState = "uninitialised"; // uninitialised | ready | unavailable
let webPushState = "uninitialised";

const initFcm = () => {
  if (fcmState !== "uninitialised") return fcmState === "ready";

  if (!config.push.firebaseServiceAccountKey) {
    logger.warn("FCM disabled — FIREBASE_SERVICE_ACCOUNT_KEY is not set");
    fcmState = "unavailable";
    return false;
  }

  try {
    admin = require("firebase-admin");
    const credential = JSON.parse(config.push.firebaseServiceAccountKey);

    // Named app: if QMS is ever loaded alongside other firebase-admin users in
    // one process, the default app is left alone.
    const existing = admin.apps.find((app) => app && app.name === "qms");
    const app =
      existing ||
      admin.initializeApp(
        {
          credential: admin.credential.cert(credential),
          ...(config.push.firebaseDbUrl ? { databaseURL: config.push.firebaseDbUrl } : {}),
        },
        "qms"
      );

    messaging = admin.messaging(app);
    fcmState = "ready";
    logger.info("FCM initialised", { projectId: credential.project_id });
    return true;
  } catch (err) {
    logger.error("FCM disabled — could not initialise firebase-admin", {
      error: err.message,
      // Overwhelmingly the most common cause: the service-account JSON was
      // double-quoted in .env, so dotenv turned the \n escapes inside
      // private_key into real newlines and JSON.parse choked on them.
      hint: err instanceof SyntaxError
        ? "FIREBASE_SERVICE_ACCOUNT_KEY must be single-line JSON in SINGLE quotes, with \\n kept escaped"
        : undefined,
    });
    fcmState = "unavailable";
    return false;
  }
};

const initWebPush = () => {
  if (webPushState !== "uninitialised") return webPushState === "ready";

  const { vapidMailto, vapidPublicKey, vapidPrivateKey } = config.push;
  if (!vapidMailto || !vapidPublicKey || !vapidPrivateKey) {
    logger.debug("Web push disabled — VAPID_* not fully configured");
    webPushState = "unavailable";
    return false;
  }

  try {
    webpush = require("web-push");
    webpush.setVapidDetails(vapidMailto, vapidPublicKey, vapidPrivateKey);
    webPushState = "ready";
    logger.info("Web push initialised");
    return true;
  } catch (err) {
    logger.error("Web push disabled — could not set VAPID details", { error: err.message });
    webPushState = "unavailable";
    return false;
  }
};

/**
 * Send an FCM multicast. Signature and payload identical to portal's
 * `sendCloudNotification({ data, notification, regTokens })`.
 */
const sendCloudNotification = async ({ data = {}, notification = null, regTokens = [] }) => {
  if (!regTokens.length) return null;
  if (!initFcm()) return null;

  const payload = {
    data,
    tokens: regTokens,
    android: {
      priority: "high", // For Android, you can set 'high' or 'normal'
    },
    apns: {
      payload: {
        aps: {
          priority: 10, // For iOS, 10 is for high priority, 5 is for normal
        },
      },
    },
  };

  if (notification) payload.notification = notification;

  try {
    const result = await messaging.sendEachForMulticast(payload);
    if (result.failureCount) {
      result.responses.forEach((response, index) => {
        if (response.success) return;
        logger.warn("FCM rejected a token", {
          // Log a prefix only — a registration token identifies a device.
          token: `${String(regTokens[index]).slice(0, 12)}…`,
          code: response.error?.code,
        });
      });
    }
    logger.debug("FCM multicast sent", {
      success: result.successCount,
      failure: result.failureCount,
    });
    return result;
  } catch (err) {
    logger.error("Cloud notification error", { error: err.message });
    return null;
  }
};

/**
 * Send one web-push message. Signature and body identical to portal's
 * `sendWebPushNotification({ webpush_obj, title, body, data, parse })`.
 */
const sendWebPushNotification = async ({ webpush_obj, title, body, data = {}, parse = false }) => {
  if (!webpush_obj) return null;
  if (!initWebPush()) return null;

  try {
    const subscription =
      parse || typeof webpush_obj === "string" ? JSON.parse(webpush_obj) : webpush_obj;

    return await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title,
        body,
        vibrate: [100, 50, 100],
        data,
      })
    );
  } catch (error) {
    // 404/410 means the browser subscription is gone — expected, not alarming.
    const status = error?.statusCode;
    if (status === 404 || status === 410) {
      logger.debug("Web push subscription expired", { status });
    } else {
      logger.warn("Web push notification error", { error: error.message, status });
    }
    return null;
  }
};

/** Whether each transport is usable, without forcing initialisation. */
const status = () => ({
  fcm: fcmState,
  webPush: webPushState,
  fcmConfigured: Boolean(config.push.firebaseServiceAccountKey),
  webPushConfigured: Boolean(
    config.push.vapidMailto && config.push.vapidPublicKey && config.push.vapidPrivateKey
  ),
});

/** Test hook. */
const reset = () => {
  fcmState = "uninitialised";
  webPushState = "uninitialised";
  messaging = null;
};

module.exports = { sendCloudNotification, sendWebPushNotification, status, reset, initFcm, initWebPush };
