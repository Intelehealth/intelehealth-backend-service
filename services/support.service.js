const openMrsDB = require("../public/javascripts/mysql/mysqlOpenMrs");
const { supportmessages, Sequelize, sequelize } = require("../models");
const { QueryTypes } = require('sequelize');

module.exports = (function () {

    this.getSystemAdministrators = async function () {
        try {
            const query = `SELECT * FROM users u LEFT JOIN user_role ur ON ur.user_id = u.user_id WHERE ur.role = 'Organizational: System Administrator' AND u.retired = 0`;
            const queryResult = await new Promise((resolve, reject) => {
                openMrsDB.query(query, (err, results, fields) => {
                if (err) reject(err);
                resolve(results);
                });
            }).catch((err) => {
                throw err;
            });
            return queryResult;
        } catch (error) {
            throw error;
        } 
    };

    this.checkIfSystemAdmin = async function (uuid) {
        try {
            const query = `SELECT * FROM users u LEFT JOIN user_role ur ON ur.user_id = u.user_id WHERE u.uuid = '${uuid}' AND ur.role = 'Organizational: System Administrator' AND u.retired = 0`;
            const queryResult = await new Promise((resolve, reject) => {
                openMrsDB.query(query, (err, results, fields) => {
                if (err) reject(err);
                resolve(results);
                });
            }).catch((err) => {
                throw err;
            });
            if (queryResult.length) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            throw error;
        } 
    };

    this.sendMessage = async function (from, to, message, type) {
        try {
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
            return {
                code: 200,
                success: true,
                message: "Message sent successfully.",
                data: data
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.readMessage = async function (userId, messageId) {
        try {
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
                        if (user && user.uuid == userId) {
                            io.to(key).emit("drUnreadCount", unreadcount[0].unread);
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
                return {
                    code: 200,
                    success: true,
                    message: "Message read successfully.",
                    data: data
                }
            }
            return {
                code: 200,
                success: false,
                message: "No such message exists",
                data: null
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.getMessages = async function (from, to) {
        try {
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
            return {
                code: 200,
                success: true,
                message: "Messages retrieved successfully.",
                data: data
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.getDoctorsList = async function (userId) {
        try {
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
                let doctorList = [];
                for (const chat of data) {
                    const m = queryResult.find(d => chat.from == d.userUuid);
                    const c = unreadcount.find(d => chat.from == d.from);
                    doctorList.push({ ...chat, ...m, unread: (c?.unread)?c?.unread : 0 });
                }
                return {
                    code: 200,
                    success: true,
                    message: "Doctor's list retrieved successfully.",
                    data: doctorList
                }
            } else {
                return {
                    code: 200,
                    success: false,
                    message: "Only system administrator can access doctor's list.",
                    data: null
                }
            }
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };
    return this;
})();