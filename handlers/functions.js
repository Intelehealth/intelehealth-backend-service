const nodemailer = require("nodemailer");
const fs = require("fs");
const url = require('url');

/**
 * Function for sending email
 * @param {*} data (to, sub)
 * @param {*} return (Sent message info)
 */
async function sendEmail(to, subject, message) {
  const { MAIL_USERNAME, MAIL_PASSWORD, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_CLIENT_REFRESH_TOKEN } =
    process.env;

  const transporter = nodemailer.createTransport({
    pool: true,
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: MAIL_USERNAME,
      pass: MAIL_PASSWORD,
      clientId: OAUTH_CLIENT_ID,
      clientSecret: OAUTH_CLIENT_SECRET,
      refreshToken: OAUTH_CLIENT_REFRESH_TOKEN
    },
  });

  const mail = await transporter.sendMail({
    from: `${MAIL_USERNAME}`,
    to: to,
    subject: subject,
    html: message,
  });
  return mail;
}

/**
 * Get formatted url
 * @param {*} req - req object
 * @returns { string } - formatted url
 */
const getFormattedUrl = (req) => {
  return url.format({
    protocol: req.protocol,
    host: req.get('host')
  });
}

/**
 * Read license key file
 * @param {*} contents - file contents
 * @param {*} key - key to be read
 */
const readLicenseFile = (contents, key) => {
  let flag = true;
  return new Promise((resolve, reject) => {
    contents.licensekey.forEach((license, index) => {
      if (key in license) {
        flag = false
        resolve({ present: true, index })
      }
    })
    if (flag) {
      resolve({ present: false })
    }
  })
}

/**
 * Write license key
 * @param {*} contents - Contents to be written to license file
 */
const writeToLicenseKey = (contents) => {
  return new Promise((resolve, reject) => {
    try {
      fs.writeFile('./public/license/license.json', JSON.stringify(contents), 'utf8', (err) => {
        if (err) reject({ message: err.message });
        else {
          resolve()
        }
      })
    } catch (error) {
      reject()
    }
  })
}

module.exports = { sendEmail, getFormattedUrl, readLicenseFile, writeToLicenseKey };
