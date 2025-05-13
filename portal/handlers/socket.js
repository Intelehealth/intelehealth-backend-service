const { user_settings } = require("../models");
const { sequelize } = require("../models");
const { QueryTypes } = require("sequelize");
const { getFirebaseAdmin, sendCloudNotification } = require("./helper");
const { deliveredById } = require("../services/message.service");
const { createCallRecordOfWebrtc, updateCallRecordOfWebrtc } = require("../services/call_data.service")

const admin = getFirebaseAdmin();

const CALL_STATUSES = {
  CALLING: "calling",
  IN_CALL: "in_call",
  DR_REJECTED: "dr_rejected",
  HW_REJECTED: "hw_rejected",
  DR_CANCELLED: "dr_cancelled",
  HW_CANCELLED: "hw_cancelled",
  IDLE: "available",
  SUCCESS: "success",
  UNSUCCESS: "failure"
};

module.exports = function (server) {
  const db = admin.database();
  const DB_NAME = `${process.env.DOMAIN.replace(/\./g, "_")}/rtc_notify`;
  const rtcNotifyRef = db.ref(DB_NAME);
  const io = require("socket.io")(server);
  global.users = {};

  /**
   * Generate UUID
   */
  function generateUUID() {
    let d = new Date().getTime();
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      d += performance.now(); // use high-precision timer if available
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

  /**
   * Emit all active socket users
   */
  function emitAllUserStatus() {
    const allUsers = Object.keys(users).map((key) => ({
      ...users[key],
      socketId: key,
    }));
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

    socket.on("disconnect", async (data) => {
      if (users[socket.id].callStatus === 'calling') {
        const callStatus = CALL_STATUSES.UNSUCCESS;
        const usersRecord = {
          recordId: users[socket.id].recordId,
          doctorId: users[socket.id].uuid,
          roomId: users[socket.id].room,
          callStatus: callStatus,
          reason: data === "ping timeout" ? 'No internet/Low bandwidth': data
        }
        await updateCallRecordOfWebrtc(usersRecord);
      }
      delete users[socket.id];
      emitAllUserStatus();
    });

    /**
     * Setup call in a room
     * @param {*} room - Room
     * @param {*} data - Call data
     */
    function callInRoom(room, data) {
      for (const socketId in users) {
        const user = users[socketId];
        if (user && user.uuid === data.connectToDrId) {
          io.sockets.to(socketId).emit("incoming_call", data);
          users[socketId].callStatus = CALL_STATUSES.CALLING;
          users[socketId].room = room;
        }
      }

      setTimeout(() => {
        for (const socketId in users) {
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
        emitAllUserStatus();
      }, 610000);
    }

    /**
     * Perform call connected actions
     * @param {*} data - Call data
     */
    function markConnected(data) {
      const { room, initiator, socketId, nurseId, roomId } = data;
      if (initiator === "dr") {
        users[socketId].callStatus = CALL_STATUSES.IN_CALL;
        users[socketId].room = roomId;
        users[socketId].nurseId = nurseId;
        for (const id in users) {
          if (users[id].uuid === nurseId) {
            users[id].callStatus = CALL_STATUSES.IN_CALL;
            users[id].room = roomId;
          }
        }
      } else {
        for (const id in users) {
          if (id === socket.id && users[id].uuid === data.connectToDrId) {
            users[id].callStatus = CALL_STATUSES.IN_CALL;
          } else if (users[id].room === room) {
            users[id].callStatus = CALL_STATUSES.IDLE;
            users[id].room = null;
            io.sockets.to(id).emit("call-connected");
          }
        }

        if (data.appSocketId) {
          users[data.appSocketId].callStatus = CALL_STATUSES.IN_CALL;
          users[data.appSocketId].room = room;
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

    socket.on("bye", async function (data) {
      const socketUser = users[data?.socketId];

      // ✅ If call was already handled in cancel_dr
      if (socketUser && socketUser.callTerminated) {
        console.log("Skipping bye: already handled by cancel_dr");
        return;
      } else {
        if (data.doctorId) {
          const usersRecord = {
            recordId: socketUser.recordId,
            doctorId: data.doctorId,
            nurseId: data.nurseId,
            roomId: data.roomId,
            callStatus: CALL_STATUSES.SUCCESS,
          }
          await updateCallRecordOfWebrtc(usersRecord);
        } else {
          for (const id in users) {
            if (id === data?.socketId) {
              const usersRecord = {
                recordId: users[id].recordId,
                doctorId: users[id].uuid,
                nurseId: data.nurseId,
                roomId: users[id].room,
                callStatus: CALL_STATUSES.SUCCESS,
              }
              await updateCallRecordOfWebrtc(usersRecord);
            }
          }
        }
        if (data?.socketId) {
          users[data?.socketId].callStatus = CALL_STATUSES.IDLE;
          users[data?.socketId].room = null;
        }

        if (data?.appSocketId) {
          users[data?.appSocketId].callStatus = CALL_STATUSES.IDLE;
          users[data?.appSocketId].room = null;
        }

        for (const id in users) {
          if (users[id].uuid === data?.nurseId) {
            users[id].callStatus = CALL_STATUSES.IDLE;
            users[id].room = null;
          }
        }
        emitAllUserStatus();
      }

    });

    socket.on("ack_msg_received", function (data) {
      data = typeof data === "string" ? JSON.parse(data) : data;
      deliveredById(data?.messageId);
    });

    socket.on("call-connected", async function (data) {
      const { visitId, doctorId, nurseId, roomId } = data;
      const callStatus = CALL_STATUSES.SUCCESS;
      //  await createCallRecordOfWebrtc(doctorId, nurseId, roomId, visitId, callStatus);
      markConnected(data);
    });

    socket.on("cancel_hw", async function (data) {
      for (const id in users) {
        if (users[id].uuid === data?.connectToDrId) {
          users[id].callStatus = CALL_STATUSES.HW_CANCELLED;
          const usersRecord = {
            recordId: users[id].recordId,
            doctorId: users[id]?.uuid,
            roomId: users[id]?.room,
            callStatus: CALL_STATUSES.UNSUCCESS,
            reason: 'Sevika disconnected the call'
          }
          await updateCallRecordOfWebrtc(usersRecord);
          emitAllUserStatus();
          setTimeout(() => {
            users[id].callStatus = CALL_STATUSES.IDLE;
            emitAllUserStatus();
          }, 2000);
          io.to(id).emit("cancel_hw", "app");
        }
      }
    });

    socket.on("cancel_dr", async function (data) {
      for (const id in users) {
        if (users[id].nurseId === data?.nurseId) {
          users[id].callStatus = CALL_STATUSES.DR_CANCELLED;
          users[id].callTerminated = true;
          const usersRecord = {
            recordId: users[id].recordId,
            doctorId: users[id].uuid,
            roomId: users[id]?.room,
            callStatus: CALL_STATUSES.UNSUCCESS,
            reason: 'Doctor disconnected the call'
          }
          await updateCallRecordOfWebrtc(usersRecord);
          emitAllUserStatus();
          setTimeout(() => {
            users[id].callStatus = CALL_STATUSES.IDLE;
            users[id].callTerminated = false;
            emitAllUserStatus();
          }, 2000);
          io.to(id).emit("cancel_dr", "webapp");
        }
      }
    });

    socket.on("call_time_up", async function (toUserUuid) {
      for (const id in users) {
        if (users[id].nurseId === toUserUuid) {
          users[id].callStatus = CALL_STATUSES.IDLE;
          users[id].callTerminated = true;
          const usersRecord = {
            recordId: users[id].recordId,
            doctorId: users[id].uuid,
            roomId: users[id].room,
            callStatus: CALL_STATUSES.UNSUCCESS,
            reason: 'Sevika not available to pick the call'
          }
          await updateCallRecordOfWebrtc(usersRecord);
          emitAllUserStatus();
          setTimeout(() => {
            users[id].callStatus = CALL_STATUSES.IDLE;
            users[id].callTerminated = false;
            emitAllUserStatus();
          }, 2000);
          io.to(id).emit("call_time_up", toUserUuid);
        }
      }
    });

    socket.on("hw_call_reject", async function (toUserUuid) {
      for (const id in users) {
        if (users[id].uuid === toUserUuid) {
          users[id].callStatus = CALL_STATUSES.HW_REJECTED;
          users[id].room = null;
          const usersRecord = {
            recordId: users[id].recordId,
            doctorId: users[id].uuid,
            roomId: users[socket.id].room,
            callStatus: CALL_STATUSES.UNSUCCESS,
            reason: 'Sevika rejected the call'
          }
          await updateCallRecordOfWebrtc(usersRecord);
          emitAllUserStatus();
          setTimeout(() => {
            users[id].callStatus = CALL_STATUSES.IDLE;
            emitAllUserStatus();
          }, 2000);
          io.to(id).emit("hw_call_reject", "app");
        }
      }
    });

    socket.on("dr_call_reject", async function (toUserUuid) {
      for (const id in users) {
        if (users[id].uuid === toUserUuid) {
          users[id].callStatus = CALL_STATUSES.DR_REJECTED;
          users[id].room = null;
          const usersRecord = {
            recordId: users[id].recordId,
            doctorId: users[id].uuid,
            roomId: users[socket.id].room,
            callStatus: CALL_STATUSES.UNSUCCESS,
            reason: 'Doctor rejected the call'
          }
          await updateCallRecordOfWebrtc(usersRecord);
          emitAllUserStatus();
          setTimeout(() => {
            users[id].callStatus = CALL_STATUSES.IDLE;
            emitAllUserStatus();
          }, 2000);
          io.to(id).emit("dr_call_reject", "webapp");
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
      users[socket.id].nurseId = nurseId;
      const { visitId, doctorId } = dataIds;
      const callStatus = CALL_STATUSES.CALLING;
      let record = await createCallRecordOfWebrtc(doctorId, nurseId, roomId, visitId, callStatus);
      users[socket.id].recordId = record?.data?.id;
      for (const id in users) {
        const userObj = users[id];
        if (userObj.uuid === nurseId) {
          io.sockets.to(id).emit("call", dataIds);
          isCalling = true;
          userObj.callStatus = CALL_STATUSES.CALLING;
          userObj.room = roomId;

          setTimeout(() => {
            for (const socketId in users) {
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
            emitAllUserStatus();
          }, 610000);
        }
      }
      emitAllUserStatus();

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

      let data = "";
      try {
        data = await user_settings.findOne({
          where: { user_uuid: nurseId },
        });
      } catch (error) { }

      sendCloudNotification({
        title: "",
        body: "",
        regTokens: [data?.device_reg_token],
        opts: {
          timeToLive: 60,
        },
        data: {
          id: generateUUID(),
          ...dataIds,
          doctorName,
          nurseId,
          roomId,
          type: "video_call",
          timestamp: Date.now().toString(),
          device_token: data?.device_reg_token || "",
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

    socket.on("ipaddr", function () {
      var ifaces = os.networkInterfaces();
      for (var dev in ifaces) {
        ifaces[dev].forEach(function (details) {
          if (details.family === "IPv4" && details.address !== "127.0.0.1") {
            socket.emit("ipaddr", details.address);
          }
        });
      }
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
