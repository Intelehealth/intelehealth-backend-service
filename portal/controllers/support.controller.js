const { RES, sendWebPushNotification } = require("../handlers/helper");
const { user_settings, pushnotification } = require("../models");

const {
    sendMessage,
    readMessage,
    getMessages,
    getSystemAdministrators,
    getDoctorsList,
    createTicket
} = require("../services/support.service");
const { Sequelize, sequelize } = require("../models");
const { QueryTypes } = require('sequelize');
const { MESSAGE } = require("../constants/messages");
const { logStream } = require("../logger/index");

module.exports = (function () {
    /**
     * Send support message
     * @param {*} req
     * @param {*} res
     */
    this.sendMessage = async (req, res) => {
        try {
            logStream('debug', 'API call', 'Support Send Message');
            const { from, to, message, type } = req.body;
            if (from && to && message && type) {
                const data = await sendMessage(from, to, message, type);
                const messages = await getMessages(from, to);
                if (data.data.dataValues.to == 'System Administrator') {
                    const systemAdministrators = (await getSystemAdministrators()).map(u => u.uuid);
                    const unreadcount = await sequelize.query("SELECT COUNT(sm.message) AS unread FROM supportmessages sm WHERE sm.to = 'System Administrator' AND sm.isRead = 0", { type: QueryTypes.SELECT });
                    for (const key in users) {
                        if (Object.hasOwnProperty.call(users, key)) {
                            const user = users[key];
                            for (const u of systemAdministrators) {
                                if (user && user.uuid == u) {
                                    data.data.dataValues.createdAt = new Date(data.data.dataValues.createdAt).toGMTString();
                                    data.data.dataValues.allMessages = messages.data;
                                    io.to(key).emit("supportMessage", data.data);
                                    io.to(key).emit("adminUnreadCount", unreadcount[0].unread);
                                }
                            }
                        }
                    }

                    // Send push notification
                    const uss = await user_settings.findAll({
                        where: {
                            user_uuid: { [Sequelize.Op.in]: systemAdministrators },
                        },
                    });
                    if (uss.length) {
                        uss.forEach(async (us) => {
                            if (us && us?.notification) {
                                if ((us?.snooze_till) ? (new Date().valueOf() > us?.snooze_till) : true) {
                                    const subscriptions = await pushnotification.findAll({
                                        where: { user_uuid: us.user_uuid },
                                    });
                                    if (subscriptions.length) {
                                        subscriptions.forEach((sub) => {
                                            sendWebPushNotification({
                                                webpush_obj: sub.notification_object,
                                                title: MESSAGE.SUPPORT.HEY_YOU_GOT_NEW_CHAT_MESSAGE_FROM_SUPPORT,
                                                body: message,
                                            });
                                        });
                                    }
                                }
                            }
                        });
                    }
                    
                } else {
                    const unreadcount = await sequelize.query(`SELECT COUNT(sm.message) AS unread FROM supportmessages sm WHERE sm.to = '${to}' AND sm.isRead = 0`, { type: QueryTypes.SELECT });
                    for (const key in users) {
                        if (Object.hasOwnProperty.call(users, key)) {
                          const user = users[key];
                          if (user && user.uuid == to) {
                            data.data.dataValues.createdAt = new Date(data.data.dataValues.createdAt).toGMTString();
                            data.data.dataValues.allMessages = messages.data;
                            io.to(key).emit("supportMessage", data.data);
                            io.to(key).emit("doctorAdminUnreadCount", unreadcount[0].unread);
                          }
                        }
                    }

                    // Send push notification
                    const us = await user_settings.findOne({
                        where: {
                            user_uuid: to,
                        },
                    });
                    if (us && us?.notification) {
                        if ((us?.snooze_till) ? (new Date().valueOf() > us?.snooze_till) : true) {
                            const subscriptions = await pushnotification.findAll({
                                where: { user_uuid: us.user_uuid },
                            });
                            if (subscriptions.length) {
                                subscriptions.forEach(async (sub) => {
                                    await sendWebPushNotification({
                                        webpush_obj: sub.notification_object, 
                                        title: MESSAGE.SUPPORT.HEY_YOU_GOT_NEW_CHAT_MESSAGE_FROM_SUPPORT, 
                                        body: message
                                    });
                                });
                            }
                        }
                    }
                }
                logStream('debug', 'Success', 'Support Send Message');
                RES(
                    res,
                    {
                      success: data.success,
                      message: data.message,
                      data: data.data,
                    },
                    data.code
                );
            } else {
                logStream('debug', 'Bad request', 'Support Send Message');
                RES(
                    res, 
                    { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null }, 
                    400
                );
            }
        } catch (error) {
            logStream("error", error.message);
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            RES(
                res,
                { success: false, data: error.data, message: error.message },
                error.code
            );
        }
    };

    /**
     * Mark message as read by messageId
     * @param {*} req
     * @param {*} res
     */
    this.readMessage = async (req, res) => {
        try {
            logStream('debug', 'API call', 'Read Message');
            const { userId, messageId } = req.params;
            if (userId, messageId) {
                const data = await readMessage(userId, messageId);
                logStream('debug', 'Success', 'Read Message');
                RES(
                    res,
                    {
                      success: data.success,
                      message: data.message,
                      data: data.data,
                    },
                    data.code
                );
            } else {
                logStream('debug', 'Bad request', 'Read Message');
                RES(
                    res, 
                    { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null }, 
                    400
                );
            }
        } catch (error) {
            logStream("error", error.message);
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            RES(
                res,
                { success: false, data: error.data, message: error.message },
                error.code
            );
        }
    };

    /**
     * Get all support messages between from and to user.
     * @param {*} req
     * @param {*} res
     */
    this.getMessages = async (req, res) => {
        try {
            logStream('debug', 'API call', 'Get Messages');
            const { from, to } = req.params;
            if (from, to) {
                const data = await getMessages(from, to);
                logStream('debug', 'Success', 'Get Messages');
                RES(
                    res,
                    {
                      success: data.success,
                      message: data.message,
                      data: data.data,
                    },
                    data.code
                );
            } else {
                logStream('debug', 'Bad request', 'Get Message');
                RES(
                    res, 
                    { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null }, 
                    400
                );
            }
        } catch (error) {
            logStream("error", error.message);
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            RES(
                res,
                { success: false, data: error.data, message: error.message },
                error.code
            );
        }
    };

    /**
     * Get Dr's list raised support messages.
     * @param {*} req
     * @param {*} res
     */
    this.getDoctorsList = async (req, res) => {
        try {
            logStream('debug', 'API call', 'Get Doctors List');
            const { userId } = req.params;
            if (userId) {
                const data = await getDoctorsList(userId);
                logStream('debug', 'Success', 'Get Doctors List');
                RES(
                    res,
                    {
                      success: data.success,
                      message: data.message,
                      data: data.data,
                    },
                    data.code
                );
            } else {
                logStream('debug', 'Bad request', 'Get Doctors List');
                RES(
                    res, 
                    { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null }, 
                    400
                );
            }
        } catch (error) {
            logStream("error", error.message);
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            RES(
                res,
                { success: false, data: error.data, message: error.message },
                error.code
            );
        }
    };

    /**
     * Get Dr's list raised support messages.
     * @param {*} req
     * @param {*} res
     */
    this.createTicket = async (req, res) => {
        try {
            logStream('debug', 'API call', 'Create Sign');
            const { userId } = req.params;
            const { ticketnumber } = req.body;
            if (userId && ticketnumber) {
                const data = await createTicket(userId, ticketnumber);
                logStream('debug', 'Success', 'Create Sign');
                RES(
                    res,
                    {
                      success: data.success,
                      message: data.message,
                      data: data.data,
                    },
                    data.code
                );
            } else {
                RES(
                    res, 
                    { success: false, message: MESSAGE.COMMON.BAD_REQUEST, data: null }, 
                    400
                );
            }
        } catch (error) {
            logStream("error", error.message);
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            RES(
                res,
                { success: false, data: error.data, message: error.message },
                error.code
            );
        }
    };

    return this;
})();
