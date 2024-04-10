const mysql = require("../public/javascripts/mysql/mysql");
const webpush = require("web-push");
const axios = require("axios");
const admin = require("firebase-admin");

const {
  FIREBASE_SERVICE_ACCOUNT_KEY,
  FIREBASE_DB_URL,
  VAPID_MAILTO,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  DOMAIN,
  OPENMRS_USERNAME,
  OPENMRS_PASS,
} = process.env;

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY)),
  databaseURL: FIREBASE_DB_URL,
});

webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const baseURL = `https://${DOMAIN}`;

const axiosInstance = axios.create({
  baseURL,
  timeout: 50000,
  headers: {
    Authorization: `Basic ${Buffer.from(
      `${OPENMRS_USERNAME}:${OPENMRS_PASS}`
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
        },
      })
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
  data = null,
  regTokens,
  click_action = "FCM_PLUGIN_HOME_ACTIVITY",
}) => {
  let payload = {};

  if (data) payload.data = data;

  if (title) {
    payload.notification = {
      title,
      icon,
      body,
      click_action,
    };
  }

  const options = {
    priority: "high",
  };

  try {
    return await messaging.sendToDevice(regTokens, payload, options);
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
  generateHash,
};