const nodemailer = require('nodemailer');


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
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD,
            clientId: process.env.OUTH_CLIENT_ID,
            clientSecret: process.env.OUTH_CLIENT_SEC,
            refreshToken: process.env.OAUTH_REFRESH_TOKEN
        }
    });

    var mailOptions = {
        from: `${process.env.MAIL_USERNAME}`,
        to: to,
        subject: subject,
        html: message
    };
    const mail = await transporter.sendMail(mailOptions);
    return mail;
}

module.exports = { sendEmail };