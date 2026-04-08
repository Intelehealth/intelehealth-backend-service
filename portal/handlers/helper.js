const mysql = require("../handlers/mysql/mysql");
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

/**
 * Initialize firebase app with credentials
 */
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY)),
  databaseURL: FIREBASE_DB_URL,
});

/**
 * Set vapid public and private keys for web push notification
 */
webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

/**
 * BaseUrl for domain
 */
const baseURL = `https://${DOMAIN}`;

/**
 * Axios instance to ftech openmrs api
 */
const axiosInstance = axios.create({
  baseURL,
  timeout: 50000,
  headers: {
    Authorization: `Basic ${Buffer.from(
      `${OPENMRS_USERNAME}:${OPENMRS_PASS}`
    ).toString("base64")}`,
  },
});

/**
 * Firebase messaging instance 
 */
const messaging = admin.messaging();

/**
 * Send web pushnotification
 * @param {*} data - { webpush_obj, title, body, data(payload) }
 */
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
        title,
        body,
        vibrate: [100, 50, 100],
        data,
      })
    );
  } catch (error) {
    console.error("Web Push notification error:", error);
  }
};

/**
 * Validate request params
 * @param {string[]} params - Array of params in request
 * @param {string[]} keysAndTypeToCheck - Array of params to be present
 */
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

/**
 * Send cloud notification using fcm
 * @param {*} data - (title, body, icon, data(payload), regTokens, click_action)
 */
const sendCloudNotification = async ({
  data = {},
  notification = null,
  regTokens,
}) => {
  const payload = {
    data,
    tokens: regTokens,
    android: {
      priority: 'high'  // For Android, you can set 'high' or 'normal'
    },
    apns: {
      payload: {
        aps: {
          priority: 10  // For iOS, 10 is for high priority, 5 is for normal
        }
      }
    }
  };

  if(notification) payload.notification = notification;

  try {
    const result = await messaging.sendEachForMulticast(payload);
    return result;
  } catch (err) {
    console.error("Cloud notification error:", err);
  }
};

/**
 * Send Prescription cloud notification using fcm
 * @param {*} data - (title, body, icon, data(payload), regTokens, click_action)
 */
  const sendPrescriptionCloudNotification = async ({
    title,
    body,
    icon = "ic_launcher",
    data = {},
    regTokens,
    click_action = "FCM_PLUGIN_HOME_ACTIVITY",
  }) => {
    const payload = {
      data: {
        ...data,
        title,
        icon,
        body,
        click_action,
      },
      tokens: regTokens,
    };
console.log("payload for FCM==",payload);
Object.entries(payload.data).forEach(([k, v]) => {
  if (typeof v !== 'string') {
    console.error(`Invalid payload: data.${k} is not a string =>`, v);
  }
});
    try {
      const result = await messaging.sendEachForMulticast(payload);
     console.log(`FCM Notification Sent: Success - ${result.successCount}, Failure - ${result.failureCount}`);
     result.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.error(` FCM Error for token [${payload.tokens[idx]}]: ${resp.error.code} - ${resp.error.message}`);
      } else {
        console.log(` FCM Success for token [${payload.tokens[idx]}]`);
      }
    });
      return result;
    } catch (err) {
      console.error("Cloud notification error:", err);
    }
  };
  
/**
 * Get firebase admin instance
 * @returns - firebase admin instance
 */
const getFirebaseAdmin = () => admin;

/**
 * Send response
 * @param {*} res - res object
 * @param {*} data - Data payload
 * @param {number} statusCode - Status code
 */
const RES = (res, data, statusCode = 200) => res.status(statusCode).json(data);

/**
 * Call callback for each item in array
 * @param { string } array - Array
 * @param {*} callback - Callback function
 */
const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

/**
 * Execute query 
 * @param { string } - Query
 * @returns {promise} - Promise containing data fetched by executing the query
 */
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

/**
 * Generate hash
 * @param { number } length - Length
 */
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
  sendPrescriptionCloudNotification
};