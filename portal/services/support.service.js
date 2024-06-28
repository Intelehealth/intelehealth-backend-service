const openMrsDB = require("../handlers/mysql/mysqlOpenMrs");
const { supportmessages, Sequelize, sequelize, supporttickets } = require("../models");
const { QueryTypes } = require('sequelize');
const { logStream } = require("../logger/index");

module.exports = (function () {

    /**
     * Get list of system administrator type users
     */
    this.getSystemAdministrators = async function () {
        try {
            logStream('debug','Support Service', 'Get System Administrators');
            const query = `SELECT * FROM users u LEFT JOIN user_role ur ON ur.user_id = u.user_id WHERE ur.role = 'Organizational: System Administrator' AND u.retired = 0`;
            const queryResult = await new Promise((resolve, reject) => {
                openMrsDB.query(query, (err, results, fields) => {
                if (err) reject(err);
                resolve(results);
                });
            }).catch((err) => {
                logStream("error", err.message);
                throw err;
            });
            logStream('debug','Success', 'Get System Administrators');
            return queryResult;
        } catch (error) {
            logStream("error", error.message);
            throw error;
        } 
    };

    /**
     * Check if user is system administrator
     * @param { string } uuid - User uuid
     */
    this.checkIfSystemAdmin = async function (uuid) {
        try {
            logStream('debug','Support Service', 'Check If SystemAdmin');
            const query = `SELECT * FROM users u LEFT JOIN user_role ur ON ur.user_id = u.user_id WHERE u.uuid = '${uuid}' AND ur.role = 'Organizational: System Administrator' AND u.retired = 0`;
            const queryResult = await new Promise((resolve, reject) => {
                openMrsDB.query(query, (err, results, fields) => {
                if (err) reject(err);
                resolve(results);
                });
            }).catch((err) => {
                throw err;
            });
            logStream('debug','Success', 'Check If SystemAdmin');
            if (queryResult.length) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            logStream("error", error.message);
            throw error;
        } 
    };

    /**
     * Send support message
     * @param { string } from - From user uuid
     * @param { string } to - To user uuid
     * @param { string } message - Message to be sent
     * @param { string } type - message type
     */
    this.sendMessage = async function (from, to, message, type) {
        try {
            logStream('debug','Support Service', 'Send Message');
            if (await this.checkIfSystemAdmin(from)) {
                from = 'System Administrator';
            } else {
                to = 'System Administrator';
            }
            const data = await supportmessages.create({
                from,
                to,
                message,
                type,
                isRead: false
            });
            logStream('debug','Success', 'Send Message');
            return {
                code: 200,
                success: true,
                message: "Message sent successfully.",
                data: data
            }
        } catch (error) {
            logStream("error", error.message);
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Read support message
     * @param { string } userId - user uuid
     * @param { string } messageId - Message id to be read
     */
    this.readMessage = async function (userId, messageId) {
        try {
            logStream('debug','Support Service', 'Read Message');
            if (await this.checkIfSystemAdmin(userId)) {
                userId = 'System Administrator';
            }
            const message = await supportmessages.findAll({
                where: {
                  id: messageId,
                  to: userId
                },
            });

            setTimeout(async () => {
                const toUser = message[0].to;
                const fromUser = message[0].from;
                const systemAdministrators = (await this.getSystemAdministrators()).map(u => u.uuid);
                const unreadcount = await sequelize.query("SELECT COUNT(sm.message) AS unread FROM supportmessages sm WHERE sm.to = 'System Administrator' AND sm.isRead = 0", { type: QueryTypes.SELECT });
                for (const key in users) {
                    if (Object.hasOwnProperty.call(users, key)) {
                        const user = users[key];
                        if (user && systemAdministrators.concat([fromUser, toUser]).includes(user.uuid)) {
                            io.to(key).emit("isreadSupport", { msgTo: toUser, msgFrom: fromUser });
                            io.to(key).emit("adminUnreadCount", unreadcount[0].unread);
                        }
                    }
                }
            }, 1000);

            if (message) {
                const data = await supportmessages.update(
                  { isRead: true },
                  {
                    where: {
                      from: [message[0].from],
                      to: userId
                    }
                  }
                );
                logStream('debug','Success', 'Read Message');
                return {
                    code: 200,
                    success: true,
                    message: "Message read successfully.",
                    data: data
                }
            }
            logStream('debug','No message exists', 'Read Message');
            return {
                code: 200,
                success: false,
                message: "No such message exists",
                data: null
            }
        } catch (error) {
            logStream("error", error.message);
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Get all support messages
     * @param { string } from - From user uuid
     * @param { string } to - To user uuid
     */
    this.getMessages = async function (from, to) {
        try {
            logStream('debug','Support Service', 'Get Messages');
            if (await this.checkIfSystemAdmin(from)) {
                from = 'System Administrator';
            } else {
                to = 'System Administrator';
            }
            const data = await supportmessages.findAll({
                where: {
                    from: { [Sequelize.Op.in]: [from, to] },
                    to: { [Sequelize.Op.in]: [to, from] },
                },
                attributes: [
                    "id",
                    "message",
                    "from",
                    "to",
                    "type",
                    "isRead",
                    "createdAt",
                ],
                order: [["createdAt", "DESC"]]
            });
            logStream('debug','Success', 'Get Messages');
            return {
                code: 200,
                success: true,
                message: "Messages retrieved successfully.",
                data: data
            }
        } catch (error) {
            logStream("error", error.message);
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Get doctors list from which support messages received to a given user
     * @param { string } userId - User uuid
     */
    this.getDoctorsList = async function (userId) {
        try {
            logStream('debug','Support Service', 'Get Doctors List');
            if (await this.checkIfSystemAdmin(userId)) {
                const data = await supportmessages.findAll({
                    
                    attributes: [
                        [Sequelize.fn("DISTINCT", Sequelize.col("from")), "from"],
                        [Sequelize.fn("max", Sequelize.col("id")), "id"],
                        "from",
                        [Sequelize.fn("max", Sequelize.col("createdAt")), "createdAt"],
                    ],
                    where: {
                        from: { [Sequelize.Op.notIn]: ['System Administrator'] },
                        to: { [Sequelize.Op.eq]: ['System Administrator'] },
                    },
                    group: ['from'],
                    order: [[Sequelize.col("createdAt"), "DESC"]],
                    raw: true
                });

                const unreadcount = await sequelize.query("SELECT COUNT(sm.message) AS unread, sm.from FROM supportmessages sm WHERE sm.to = 'System Administrator' AND sm.isRead = 0  GROUP BY sm.from", { type: QueryTypes.SELECT });

                const query = "SELECT u.uuid AS userUuid, p.uuid AS personUuid, CONCAT(pn.given_name, ' ', pn.middle_name, ' ', pn.family_name) AS doctorName FROM users u LEFT JOIN person p ON p.person_id = u.person_id LEFT JOIN person_name pn ON pn.person_id = u.person_id WHERE u.uuid IN ('" + data.map(d => d.from).join("','") + "') AND pn.preferred = 1 AND u.retired = 0";
                const queryResult = await new Promise((resolve, reject) => {
                    openMrsDB.query(query, (err, results, fields) => {
                    if (err) reject(err);
                    resolve(results);
                    });
                }).catch((err) => {
                    throw err;
                });
                const doctorList = [];
                for (const chat of data) {
                    const m = queryResult.find(d => chat.from == d.userUuid);
                    const c = unreadcount.find(d => chat.from == d.from);
                    doctorList.push({ ...chat, ...m, unread: (c?.unread)?c?.unread : 0 });
                }
                logStream('debug','Success', 'Get Doctors List');
                return {
                    code: 200,
                    success: true,
                    message: "Doctor's list retrieved successfully.",
                    data: doctorList
                }
            } else {
                logStream('debug','Only system administrator can access doctor list', 'Get Doctors List');
                return {
                    code: 200,
                    success: false,
                    message: "Only system administrator can access doctor's list.",
                    data: null
                }
            }
        } catch (error) {
            logStream("error", error.message);
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Create support ticket
     * @param { string } userId - User uuid
     * @param { string } ticketnumber - Ticket number
     */
    this.createTicket = async function (userId, ticketnumber) {
        try {
            logStream('debug','Support Service', 'Create Ticket');
            const data = await supporttickets.create({
                userId,
                ticketnumber
            });
            logStream('debug','Ticket Created', 'Create Ticket');
            return {
                code: 200,
                success: true,
                message: "Ticket created successfully.",
                data: data
            }
        } catch (error) {
            logStream("error", error.message);
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    return this;
})();