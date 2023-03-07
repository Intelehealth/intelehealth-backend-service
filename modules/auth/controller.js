const service = require('./auth');

const controller = {
    requestOtp: async (req, res) => {
        try {
            const { email, phoneNumber, countryCode = 91, username, otpFor } = req.body;
            if ((email || phoneNumber || username) && otpFor) {
                if (phoneNumber) {
                    if (!countryCode) {
                        res.status(400).send({
                            success: false,
                            message: "Bad request! Invalid arguments.",
                            data: null
                        });
                    }
                }
                const data = await service.authService().requestOtp(email, phoneNumber, countryCode, username, otpFor);
                res.status(data.code).send({
                    success: data.success,
                    message: data.message,
                    data: data.data
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "Bad request! Invalid arguments.",
                    data: null
                });
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            res.status(error.code).send({ success: false, data: error.data, message: error.message });
        }
    },

    verifyOtp: async (req, res) => {
        try {
            const { email, phoneNumber, username, verifyFor, otp } = req.body;
            if ((email || phoneNumber || username) && verifyFor && otp) {
                const data = await service.authService().verfifyOtp(email, phoneNumber, username, verifyFor, otp);
                res.status(data.code).send({
                    success: data.success,
                    message: data.message,
                    data: data.data
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "Bad request! Invalid arguments.",
                    data: null
                });
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            res.status(error.code).send({ success: false, data: error.data, message: error.message });
        }
    },

    resetPassword: async (req, res) => {
        try {
            const userUuid = req.params.userUuid;
            const newPassword = req.body.newPassword;

            if (userUuid && newPassword) {
                const data = await service.authService().resetPassword(userUuid, newPassword);
                res.status(data.code).send({
                    success: data.success,
                    message: data.message,
                    data: data.data
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "Bad request! Invalid arguments.",
                    data: null
                });
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            res.status(error.code).send({ success: false, data: error.data, message: error.message });
        }
    }
}

module.exports = controller;