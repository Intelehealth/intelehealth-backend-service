const { RES } = require("../handlers/helper");
const { sendNotification, getSubscriptions } = require("../handlers/web-push");
const { user_settings } = require("../models");

const {
    sendMessage,
    readMessage,
    getMessages,
    getSystemAdministrators,
    getDoctorsList
} = require("../services/support.service");
const { Sequelize, sequelize } = require("../models");
const { QueryTypes } = require('sequelize');

module.exports = (function () {
    /**
     * Send support message
     * @param {*} req
     * @param {*} res
     */
    this.sendMessage = async (req, res) => {
        try {
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
                                const subscriptions = await getSubscriptions(us.user_uuid);
                                if (subscriptions.length) {
                                    subscriptions.forEach(async (sub) => {
                                        await sendNotification(JSON.parse(sub.notification_object), 'Hey! You got new chat message for support', message);
                                    });
                                }
                            }
                        });
                    }
                    
                } else {
                    for (const key in users) {
                        if (Object.hasOwnProperty.call(users, key)) {
                          const user = users[key];
                          if (user && user.uuid == to) {
                            data.data.dataValues.createdAt = new Date(data.data.dataValues.createdAt).toGMTString();
                            data.data.dataValues.allMessages = messages.data;
                            io.to(key).emit("supportMessage", data.data);
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
                        const subscriptions = await getSubscriptions(us.user_uuid);
                        if (subscriptions.length) {
                            subscriptions.forEach(async (sub) => {
                                await sendNotification(JSON.parse(sub.notification_object), 'Hey! You got new chat message from support', message);
                            });
                        }
                    }
                }

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
                    { success: false, message: "Bad request! Invalid arguments.", data: null }, 
                    400
                );
            }
        } catch (error) {
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
            const { userId, messageId } = req.params;
            if (userId, messageId) {
                const data = await readMessage(userId, messageId);
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
                    { success: false, message: "Bad request! Invalid arguments.", data: null }, 
                    400
                );
            }
        } catch (error) {
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
            const { from, to } = req.params;
            if (from, to) {
                const data = await getMessages(from, to);
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
                    { success: false, message: "Bad request! Invalid arguments.", data: null }, 
                    400
                );
            }
        } catch (error) {
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
            const { userId } = req.params;
            if (userId) {
                const data = await getDoctorsList(userId);
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
                    { success: false, message: "Bad request! Invalid arguments.", data: null }, 
                    400
                );
            }
        } catch (error) {
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
