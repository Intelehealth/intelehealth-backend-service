const nodemailer = require('nodemailer');

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
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: MAIL_USERNAME,
            pass: MAIL_PASSWORD,
            clientId: OAUTH_CLIENT_ID,
            clientSecret: OAUTH_CLIENT_SECRET,
            refreshToken: OAUTH_CLIENT_REFRESH_TOKEN
        }
    });

    const mailOptions = {
        from: `${MAIL_USERNAME}`,
        to: to,
        subject: subject,
        html: message
    };
    const mail = await transporter.sendMail(mailOptions);
    return mail;
}

module.exports = { sendEmail };