#!/usr/bin/env node
/**
 * Diagnose push delivery for one user, against the real database.
 *
 * Answers the question you actually have when a notification does not arrive:
 * is it a missing Firebase credential, a missing device token, a snooze, or is
 * everything fine and the problem is elsewhere?
 *
 * Reads the same tables portal reads — user_settings.device_reg_token and
 * pushnotification.notification_object — so what it prints is exactly what the
 * notification service will resolve at send time.
 *
 *   node tools/check-push-recipient.js <userUuid>
 *   node tools/check-push-recipient.js <userUuid> --send    # actually push a test
 *
 * --send delivers a real "queue:position" notification to that user's devices.
 * Only do that against a device you own.
 */
const models = require("../src/models");
const config = require("../src/config/env");
const recipients = require("../src/services/recipients.service");
const push = require("../src/services/push.service");
const messages = require("../src/services/notificationMessages");
const { EVENT } = require("../src/constants/events");
const { describeError: describe } = require("../src/utils/errors");

const userUuid = process.argv[2];
const doSend = process.argv.includes("--send");

const line = (label, value) => console.log(`  ${label.padEnd(26)} ${value}`);

(async () => {
  if (!userUuid) {
    console.error("usage: node tools/check-push-recipient.js <userUuid> [--send]");
    process.exit(2);
  }

  console.log(`\nQMS push diagnostics for ${userUuid}\n`);

  console.log("Database");
  try {
    await models.sequelize.authenticate();
    line("connection", "ok");
    line("database", config.db.name);
  } catch (err) {
    line("connection", `FAILED — ${describe(err)}`);
    process.exit(1);
  }

  // Are portal's tables actually visible from this database?
  for (const table of ["user_settings", "pushnotification"]) {
    try {
      const [row] = await models.sequelize.query(
        `SELECT COUNT(*) AS n FROM \`${table}\``,
        { type: models.Sequelize.QueryTypes.SELECT }
      );
      line(`${table} rows`, row.n);
    } catch (err) {
      line(`${table}`, `UNREADABLE — ${describe(err)}`);
    }
  }

  console.log("\nTransports");
  line("notifications", config.notification.enabled ? "enabled" : "DISABLED");
  const status = push.status();
  line("FCM credential", status.fcmConfigured ? "present" : "MISSING (FIREBASE_SERVICE_ACCOUNT_KEY)");
  line("web push VAPID", status.webPushConfigured ? "present" : "missing (VAPID_*)");

  console.log("\nRecipient");
  const target = await recipients.forUser(userUuid);
  if (!target) {
    line("result", "NO REGISTERED DEVICE");
    console.log(
      "\n  → No row in user_settings with a device_reg_token for this uuid, and no\n" +
        "    web-push subscription. The user must register a device through the app\n" +
        "    first; QMS does not create registrations, it reads portal's.\n"
    );
    await models.sequelize.close();
    process.exit(0);
  }

  line("locale", target.locale);
  line("FCM tokens", target.tokens.length ? target.tokens.map((t) => `${t.slice(0, 12)}…`).join(", ") : "none");
  line("web push subscriptions", target.webpushSubs.length);
  line("snoozed", target.snoozed ? "YES — notifications withheld" : "no");

  const sample = {
    queueEntryId: 0,
    hwUserUuid: userUuid,
    visitUuid: "00000000-0000-0000-0000-000000000000",
    patientUuid: "00000000-0000-0000-0000-000000000000",
    DoctorUuid: "00000000-0000-0000-0000-000000000000",
    speciality: "Diagnostics",
    status: "QUEUED",
    position: 2,
    etaTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    title: "QMS Notification",
    type: "Queue update",
  };

  console.log("\nWhat would be sent");
  const { title, body } = messages.build(sample, target.locale);
  line("title", title);
  line("body", body);
  line("data keys", Object.keys(messages.toDataPayload(sample)).join(", "));

  if (!doSend) {
    console.log("\n  (dry run — pass --send to actually deliver this to the devices above)\n");
    await models.sequelize.close();
    return;
  }

  console.log("\nSending…");
  if (target.tokens.length) {
    const result = await push.sendCloudNotification({
      data: messages.toDataPayload(sample),
      // notification: { title, body },
      regTokens: target.tokens,
    });
    line("FCM", result ? `success ${result.successCount}, failure ${result.failureCount}` : "not sent");
  }
  for (const subscription of target.webpushSubs) {
    const result = await push.sendWebPushNotification({
      webpush_obj: subscription,
      title,
      body,
      data: messages.toDataPayload(sample),
      parse: typeof subscription === "string",
    });
    line("web push", result ? `status ${result.statusCode}` : "not sent");
  }
  console.log();

  await models.sequelize.close();
})().catch(async (err) => {
  console.error("\nDiagnostics failed:", describe(err));
  try {
    await models.sequelize.close();
  } catch (_) {
    /* already closed */
  }
  process.exit(1);
});
