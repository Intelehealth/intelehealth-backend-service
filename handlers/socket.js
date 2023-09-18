const { user_settings } = require("../models");
// const admin = require("firebase-admin");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];
const { sequelize } = require("../models");
const { QueryTypes } = require("sequelize");
const { getFirebaseAdmin, sendCloudNotification } = require("./helper");
const { deliveredById } = require("../services/message.service");

const admin = getFirebaseAdmin();

const CALL_STATUSES = {
  CALLING: "calling",
  IN_CALL: "in_call",
  DR_REJECTED: "dr_rejected",
  HW_REJECTED: "hw_rejected",
  DR_CANCELLED: "dr_cancelled",
  HW_CANCELLED: "hw_cancelled",
  IDLE: "available",
};

module.exports = function (server) {
  const db = admin.database();
  const DB_NAME = `${config.domain.replace(/\./g, "_")}/rtc_notify`;
  const rtcNotifyRef = db.ref(DB_NAME);
  const io = require("socket.io")(server);
  global.users = {};

  /**
   * Declare functions here.
   */
  function generateUUID() {
    let d = new Date().getTime();
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      d += performance.now(); //use high-precision timer if available
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        let r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }
    );
  }

  function emitAllUserStatus() {
    const allUsers = [];
    for (const key in users) {
      allUsers.push({ ...users[key], socketId: key });
    }
    io.sockets.emit("allUsers", allUsers);
  }

  /**
   * End of function declarations
   */
  io.on("connection", (socket) => {
    if (!users[socket.id]) {
      users[socket.id] = {
        uuid: socket.handshake.query.userId,
        status: "online",
        name: socket.handshake.query.name,
        callStatus: CALL_STATUSES.IDLE,
      };
    }

    emitAllUserStatus();

    socket.on("disconnect", () => {
      delete users[socket.id];
      emitAllUserStatus();
    });

    function callInRoom(room, data) {
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          const user = users[socketId];
          if (user && user.uuid === data.connectToDrId) {
            io.sockets.to(socketId).emit("incoming_call", data);
            users[socketId].callStatus = CALL_STATUSES.CALLING;
            users[socketId].room = room;
          }
        }
      }
      emitAllUserStatus();

      setTimeout(() => {
        for (const socketId in users) {
          if (Object.hasOwnProperty.call(users, socketId)) {
            if (
              users[socketId] &&
              users[socketId].room &&
              users[socketId].room === room &&
              users[socketId].callStatus === CALL_STATUSES.CALLING
            ) {
              users[socketId].callStatus = CALL_STATUSES.IDLE;
              users[socketId].room = null;
            }
          }
        }
        emitAllUserStatus();
      }, 610000);
    }

    function markConnected(data) {
      const { patientId: room, initiator, socketId, nurseId, roomId } = data;
      if (initiator === "dr") {
        users[socketId].callStatus = CALL_STATUSES.IN_CALL;
        users[socketId].room = roomId;
        for (const socketId in users) {
          if (Object.hasOwnProperty.call(users, socketId)) {
            if (users[socketId].uuid === nurseId) {
              users[socketId].callStatus = CALL_STATUSES.IN_CALL;
              users[socketId].room = roomId;
            }
          }
        }
      } else {
        for (const socketId in users) {
          if (Object.hasOwnProperty.call(users, socketId)) {
            if (
              socketId === data?.socketId &&
              users[socketId].uuid === data?.connectToDrId
            ) {
              users[socketId].callStatus = CALL_STATUSES.IN_CALL;
            } else if (users[socketId].room === room) {
              users[socketId].callStatus = CALL_STATUSES.IDLE;
              users[socketId].room = null;
              io.sockets.to(socketId).emit("call-connected");
            }
          }
        }

        if (data?.appSocketId) {
          users[data?.appSocketId].callStatus = CALL_STATUSES.IN_CALL;
          users[data?.appSocketId].room = room;
        }
      }
      emitAllUserStatus();
    }

    /**
     * HW to Dr call events
     */
    socket.on("create_or_join_hw", function (hwData) {
      const { patientId: room } = hwData;
      hwData.nurseId = users[socket.id].uuid;
      hwData.appSocketId = socket.id;

      callInRoom(room, hwData);
    });

    socket.on("bye", function (data) {
      if (data?.socketId) {
        users[data?.socketId].callStatus = CALL_STATUSES.IDLE;
        users[data?.socketId].room = null;
      }

      if (data?.appSocketId) {
        users[data?.appSocketId].callStatus = CALL_STATUSES.IDLE;
        users[data?.appSocketId].room = null;
      }

      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          if (users[socketId].uuid === data?.nurseId) {
            users[socketId].callStatus = CALL_STATUSES.IDLE;
            users[socketId].room = null;
          }
        }
      }
      emitAllUserStatus();
    });

    socket.on("ack_msg_received", function (data) {
      if (typeof data === "string") {
        data = JSON.parse(data);
        deliveredById(data?.messageId);
      } else {
        deliveredById(data?.messageId);
      }
    });

    socket.on("call-connected", async function (data) {
      markConnected(data);
    });

    socket.on("cancel_hw", async function (data) {
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          if (users[socketId].uuid === data?.connectToDrId) {
            users[socketId].callStatus = CALL_STATUSES.HW_CANCELLED;
            users[socketId].room = null;
            emitAllUserStatus();
            setTimeout(() => {
              users[socketId].callStatus = CALL_STATUSES.IDLE;
              emitAllUserStatus();
            }, 2000);
            io.to(socketId).emit("cancel_hw", "app");
          }
        }
      }
    });

    socket.on("cancel_dr", async function (data) {
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          if (users[socketId].uuid === data?.nurseId) {
            users[socketId].callStatus = CALL_STATUSES.DR_CANCELLED;
            users[socketId].room = null;
            emitAllUserStatus();
            setTimeout(() => {
              users[socketId].callStatus = CALL_STATUSES.IDLE;
              emitAllUserStatus();
            }, 2000);
            io.to(socketId).emit("cancel_dr", "webapp");
          }
        }
      }
    });

    socket.on("call_time_up", async function (toUserUuid) {
      console.log("toUserUuid: ", toUserUuid);
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          if (users[socketId].uuid === toUserUuid) {
            users[socketId].callStatus = CALL_STATUSES.IDLE;
            users[socketId].room = null;
            emitAllUserStatus();
            setTimeout(() => {
              users[socketId].callStatus = CALL_STATUSES.IDLE;
              emitAllUserStatus();
            }, 2000);
            io.to(socketId).emit("call_time_up", toUserUuid);
          }
        }
      }
    });

    socket.on("hw_call_reject", async function (toUserUuid) {
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          if (users[socketId].uuid === toUserUuid) {
            users[socketId].callStatus = CALL_STATUSES.HW_REJECTED;
            users[socketId].room = null;
            emitAllUserStatus();
            setTimeout(() => {
              users[socketId].callStatus = CALL_STATUSES.IDLE;
              emitAllUserStatus();
            }, 2000);
            io.to(socketId).emit("hw_call_reject", "app");
          }
        }
      }
    });

    socket.on("dr_call_reject", async function (toUserUuid) {
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          if (users[socketId].uuid === toUserUuid) {
            users[socketId].callStatus = CALL_STATUSES.DR_REJECTED;
            users[socketId].room = null;
            emitAllUserStatus();
            setTimeout(() => {
              users[socketId].callStatus = CALL_STATUSES.IDLE;
              emitAllUserStatus();
            }, 2000);
            io.to(socketId).emit("dr_call_reject", "webapp");
          }
        }
      }
    });

    /**
     * Dr. to HW call events
     */
    socket.on("create or join", function (room) {
      var clientsInRoom = io.sockets.adapter.rooms[room];
      var numClients = clientsInRoom
        ? Object.keys(clientsInRoom.sockets).length
        : 0;
      socket.on("message", function (message) {
        io.sockets.in(room).emit("message", message);
      });

      if (numClients === 0) {
        socket.join(room);
        socket.emit("created", room, socket.id);
      } else if (numClients === 1) {
        io.sockets.in(room).emit("join", room);
        socket.join(room);
        socket.emit("joined", room, socket.id);
        io.sockets.in(room).emit("ready");
      } else {
        socket.emit("full", room);
      }
    });

    socket.on("call", async function (dataIds) {
      const { nurseId, doctorName, roomId } = dataIds;
      let isCalling = false;
      users[socket.id].callStatus = CALL_STATUSES.CALLING;
      users[socket.id].room = roomId;

      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          const userObj = users[socketId];
          if (userObj.uuid === nurseId) {
            io.sockets.to(socketId).emit("call", dataIds);
            isCalling = true;
            users[socketId].callStatus = CALL_STATUSES.CALLING;
            users[socketId].room = roomId;

            setTimeout(() => {
              for (const socketId in users) {
                if (Object.hasOwnProperty.call(users, socketId)) {
                  if (
                    users[socketId] &&
                    users[socketId].room &&
                    users[socketId].room === roomId &&
                    users[socketId].callStatus === CALL_STATUSES.CALLING
                  ) {
                    users[socketId].callStatus = CALL_STATUSES.IDLE;
                    users[socketId].room = null;
                  }
                }
              }
              emitAllUserStatus();
            }, 610000);
          }
        }
      }
      emitAllUserStatus();

      let data = "";
      if (!isCalling) {
        const room = roomId;
        setTimeout(() => {
          var clientsInRoom = io.sockets.adapter.rooms[room];
          var numClients = clientsInRoom
            ? Object.keys(clientsInRoom.sockets).length
            : 0;

          if (numClients < 2) {
            socket.emit("toast", {
              duration: 2000,
              message:
                "Not able to reach the health worker at this moment. Please try again after sometime.",
            });
          }
        }, 10000);
      }

      try {
        data = await user_settings.findOne({
          where: { user_uuid: nurseId },
        });
      } catch (error) {}

      sendCloudNotification({
        title:'',
        body:'',
        regTokens: [data?.device_reg_token],
        opts:{
          timeToLive: 60
        },
        data: {
          id: generateUUID(),
          ...dataIds,
          callEnded: false,
          doctorName,
          nurseId,
          roomId,
          timestamp: Date.now().toString(),
          device_token:
            data && data.device_reg_token ? data.device_reg_token : "",
        },
      });

      // await rtcNotifyRef.update({
      //   [nurseId]: {
      //     VIDEO_CALL: {
      //       id: generateUUID(),
      //       ...dataIds,
      //       callEnded: false,
      //       doctorName,
      //       nurseId,
      //       roomId,
      //       timestamp: Date.now(),
      //       device_token:
      //         data && data.device_reg_token ? data.device_reg_token : "",
      //     },
      //   },
      // });
    });

    /**
     * Admin socket events below
     */
    socket.on("getAdminUnreadCount", async function () {
      const unreadcount = await sequelize.query(
        "SELECT COUNT(sm.message) AS unread FROM supportmessages sm WHERE sm.to = 'System Administrator' AND sm.isRead = 0",
        { type: QueryTypes.SELECT }
      );
      socket.emit("adminUnreadCount", unreadcount[0].unread);
    });

    socket.on("getDrUnreadCount", async function (data) {
      const unreadcount = await sequelize.query(
        `SELECT COUNT(sm.message) AS unread FROM supportmessages sm WHERE sm.to = '${data}' AND sm.isRead = 0`,
        { type: QueryTypes.SELECT }
      );
      socket.emit("drUnreadCount", unreadcount[0].unread);
    });
  });
  global.io = io;
};
