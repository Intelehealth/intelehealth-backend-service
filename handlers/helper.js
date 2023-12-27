const mysql = require("../public/javascripts/mysql/mysql");
const webpush = require("web-push");
const axios = require("axios");
const admin = require("firebase-admin");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];
const serviceAccount = require(__dirname + "/../config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ezazi-8712a-default-rtdb.firebaseio.com",
});

const vapidKeys = {
  /** web push keys for  - https://ezazi.intelehealth.org */
  publicKey:
    "BM4tUVW1UwkMpfAWh2mwhA-wwdIC2rCF1MFypbFpjn23qYMQXaeAaYi6ydGslRb_Vdr2Ws0MW5RSUH9InEbYNhA",
  privateKey: "2x0DTVhRpzAaBfbcdWJNrBk7yTTE2gJivTavfLjQXhY",
  mailTo: "mailto: <support@intelehealth.org>",
};

webpush.setVapidDetails(
  vapidKeys.mailTo,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const baseURL = `https://${config.domain}`;

const axiosInstance = axios.create({
  baseURL,
  timeout: 50000,
  headers: {
    Authorization: `Basic ${Buffer.from(
      `${config.openMrsUsername}:${config.openMrsPassword}`
    ).toString("base64")}`,
  },
});

const messaging = admin.messaging();

const sendWebPushNotification = async ({
  webpush_obj,
  title,
  body,
  data = {},
  parse = false,
  options = { TTL: "3600000" }
}) => {
  try {
    return await webpush.sendNotification(
      parse ? JSON.parse(webpush_obj) : webpush_obj,
      JSON.stringify({
        notification: {
          title,
          body,
          vibrate: [100, 50, 100],
          data,
          icon: 'assets/icons/icon-512x512.png'
        },
      }),
      options
    );
  } catch (error) {
    console.error("Web Push notification error:", error);
  }
};

const validateParams = (params, keysAndTypeToCheck = []) => {
  try {
    keysAndTypeToCheck.forEach((obj) => {
      if (!params[obj.key] || typeof params[obj.key] !== obj.type) {
        throw new Error(
          !params[obj.key]
            ? `Invalid request, ${obj.key} is missing.`
            : `Wrong param type for ${obj.key} (${typeof params[
                obj.key
              ]}), required type is ${obj.type}.`
        );
      }
    });
    return true;
  } catch (error) {
    throw error;
  }
};

const sendCloudNotification = async ({
  title,
  body,
  icon = "ic_launcher",
  data = {},
  regTokens,
  click_action = "FCM_PLUGIN_HOME_ACTIVITY",
}) => {
  const payload = {
    data,
    notification: {
      title,
      icon,
      body,
      click_action,
    },
  };

  const options = {
    priority: "high",
  };

  try {
    const result = await messaging.sendToDevice(regTokens, payload, options);
  } catch (err) {
    console.error("Cloud notification error:", err);
  }
};

const getFirebaseAdmin = () => admin;

const RES = (res, data, statusCode = 200) => res.status(statusCode).json(data);

const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

const getDataFromQuery = (query) =>
  new Promise((resolve, reject) => {
    mysql.query(query, (err, results) => {
      if (err) {
        console.error("MySQL query error:", err);
        reject(err.message);
      }
      resolve(results);
    });
  });

const generateHash = (length) =>
  Math.round(Math.pow(36, length + 1) - Math.random() * Math.pow(36, length))
    .toString(36)
    .slice(1);

module.exports = {
  axiosInstance,
  sendWebPushNotification,
  validateParams,
  sendCloudNotification,
  getFirebaseAdmin,
  RES,
  asyncForEach,
  getDataFromQuery,
  generateHash
};
