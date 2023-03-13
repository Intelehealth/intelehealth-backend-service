const nodemailer = require('nodemailer');
const config = require('../config/config.json');

/**
 * Function for sending email
 * @param {*} data (to, sub)
 * @param {*} return (Sent message info)
 */
async function sendEmail(to, subject, message) {
    const env = process.env.NODE_ENV ? process.env.NODE_ENV : "production";
    var transporter = nodemailer.createTransport({
        pool: true,
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: config[env].mailUsername,
            pass: config[env].mailPassword,
            clientId: config[env].oauthClientId,
            clientSecret: config[env].oauthClientSecret,
            refreshToken: config[env].oauthRefreshToken
        }
    });

    var mailOptions = {
        from: `${config[env].mailUsername}`,
        to: to,
        subject: subject,
        html: message
    };
    const mail = await transporter.sendMail(mailOptions);
    return mail;
}

module.exports = { sendEmail };