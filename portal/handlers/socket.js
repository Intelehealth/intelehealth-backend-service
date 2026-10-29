const { user_settings } = require("../models");
const { sequelize } = require("../models");
const { QueryTypes } = require("sequelize");
const { getFirebaseAdmin, sendCloudNotification } = require("./helper");
const { deliveredById } = require("../services/message.service");
const { createCallRecordOfWebrtc, updateCallRecordOfWebrtc, isCallRecordOpen } = require("../services/call_data.service")
const { registerAiDdxSocket } = require("./ai-ddx-socket");

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

// socket.io disconnect reason -> call_data.reason
const DISCONNECT_REASONS = {
  "transport error": "Internet disconnected/Weak network",
  "ping timeout": "No internet",
  "transport close": "Connection closed (page closed/reloaded or network lost)",
  "client namespace disconnect": "Doctor left the page",
  "server namespace disconnect": "Disconnected by server",
};

// Reasons after which the client opens a new socket by itself (reconnect, page re-creating it).
const RECONNECTING_REASONS = ["transport error", "ping timeout", "client namespace disconnect"];

// How long a ringing call waits for the doctor's new socket before it is marked failed.
const RECONNECT_GRACE_MS = 5000;

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
        connectedAt: Date.now(),
      };
    }

    emitAllUserStatus();
    registerAiDdxSocket(socket);

    socket.on("disconnect", async (data) => {
      const user = users[socket.id];
      const disconnectedAt = Date.now();
      delete users[socket.id];
      emitAllUserStatus();

      if (user?.callStatus === CALL_STATUSES.CALLING && user.recordId) {
        setTimeout(() => {
          handOverOrFailCall(user, data, disconnectedAt).catch((error) =>
            console.error("Error closing call after disconnect:", error)
          );
        }, RECONNECT_GRACE_MS);
      }
    });

    /**
     * A doctor's socket dropped while their call was ringing. If the same doctor came back on a
     * new socket, move the call to it so later events (bye, cancel, time up) still find the
     * record; otherwise mark the call failed with the disconnect reason.
     */
    async function handOverOrFailCall(user, reason, disconnectedAt) {
      if (!(await isCallRecordOpen(user.recordId))) return;

      if (RECONNECTING_REASONS.includes(reason)) {
        const newSocketId = Object.keys(users).find((id) =>
          users[id].uuid === user.uuid &&
          !users[id].recordId &&
          users[id].connectedAt >= disconnectedAt - 1000
        );
        if (newSocketId) {
          Object.assign(users[newSocketId], {
            recordId: user.recordId,
            room: user.room,
            nurseId: user.nurseId,
            callStatus: user.callStatus,
          });
          emitAllUserStatus();
          return;
        }
      }

      await updateCallRecordOfWebrtc({
        recordId: user.recordId,
        doctorId: user.uuid,
        roomId: user.room,
        callStatus: CALL_STATUSES.UNSUCCESS,
        reason: DISCONNECT_REASONS[reason] || `Disconnected (${reason})`,
      });
    }

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

      // If call was already handled in cancel_dr
      if (socketUser && socketUser.callTerminated) {
        return;
      } else {
        // socketUser is missing when the doctor's socket was replaced mid-call; the row is
        // then looked up by doctor and room.
        const doctorId = data?.doctorId || socketUser?.uuid;
        const roomId = data?.doctorId ? data?.roomId : socketUser?.room;
        if (socketUser || doctorId) {
          const usersRecord = {
            recordId: socketUser?.recordId,
            doctorId,
            nurseId: data?.nurseId,
            roomId,
            callStatus: CALL_STATUSES.SUCCESS,
            findOpen: Boolean(roomId),
          }
          await updateCallRecordOfWebrtc(usersRecord);
        }
        if (socketUser) {
          socketUser.callStatus = CALL_STATUSES.IDLE;
          socketUser.room = null;
        }

        if (data?.appSocketId && users[data.appSocketId]) {
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
      for (const id in users) {
        if (id === data?.socketId) {
          const startTime = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
          const usersRecord = {
            recordId: users[id].recordId,
            doctorId: users[id]?.uuid,
            roomId: users[id]?.room,
            startTime: startTime
          }
          await updateCallRecordOfWebrtc(usersRecord);
        }
      }
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
            reason: 'HW disconnected the call'
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
      // Tell the health worker's app to stop ringing. Their socket is keyed by uuid; only the
      // calling doctor's socket carries nurseId, so the loop below never reaches the app.
      for (const id in users) {
        if (data?.nurseId && users[id].uuid === data.nurseId) {
          users[id].callStatus = CALL_STATUSES.IDLE;
          users[id].room = null;
          io.to(id).emit("cancel_dr", "webapp");
        }
      }

      // Close the calling doctor's call record.
      const reason = 'Doctor disconnected the call';
      let recordUpdated = false;
      for (const id in users) {
        if (data?.nurseId && users[id].nurseId === data.nurseId) {
          users[id].callStatus = CALL_STATUSES.DR_CANCELLED;
          users[id].callTerminated = true;
          if (users[id].recordId) {
            const usersRecord = {
              recordId: users[id].recordId,
              doctorId: users[id].uuid,
              roomId: users[id]?.room,
              callStatus: CALL_STATUSES.UNSUCCESS,
              reason
            }
            await updateCallRecordOfWebrtc(usersRecord);
            recordUpdated = true;
          }
          emitAllUserStatus();
          setTimeout(() => {
            if (!users[id]) return;
            users[id].callStatus = CALL_STATUSES.IDLE;
            users[id].callTerminated = false;
            emitAllUserStatus();
          }, 2000);
          io.to(id).emit("cancel_dr", "webapp");
        }
      }
      // The socket that started the call was replaced (page re-created it, reconnect).
      if (!recordUpdated) {
        await updateCallRecordOfWebrtc({
          doctorId: data?.doctorId || users[socket.id]?.uuid,
          roomId: data?.roomId,
          nurseId: data?.nurseId,
          callStatus: CALL_STATUSES.UNSUCCESS,
          reason,
          findOpen: true
        });
      }
    });

    socket.on("call_time_up", async function (toUserUuid) {
      const reason = 'HW not available to pick the call';
      let recordUpdated = false;
      for (const id in users) {
        if (toUserUuid && users[id].nurseId === toUserUuid) {
          users[id].callStatus = CALL_STATUSES.IDLE;
          users[id].callTerminated = true;
          if (users[id].recordId) {
            const usersRecord = {
              recordId: users[id].recordId,
              doctorId: users[id].uuid,
              roomId: users[id].room,
              callStatus: CALL_STATUSES.UNSUCCESS,
              reason
            }
            await updateCallRecordOfWebrtc(usersRecord);
            recordUpdated = true;
          }
          emitAllUserStatus();
          setTimeout(() => {
            if (!users[id]) return;
            users[id].callStatus = CALL_STATUSES.IDLE;
            users[id].callTerminated = false;
            emitAllUserStatus();
          }, 2000);
          io.to(id).emit("call_time_up", toUserUuid);
        }
      }
      if (!recordUpdated && toUserUuid) {
        await updateCallRecordOfWebrtc({
          doctorId: users[socket.id]?.uuid,
          nurseId: toUserUuid,
          callStatus: CALL_STATUSES.UNSUCCESS,
          reason,
          findOpen: true
        });
      }
    });

    socket.on("hw_call_reject", async function (toUserUuid) {
      const reason = 'HW rejected the call';
      const roomId = users[socket.id]?.room;
      let recordUpdated = false;
      for (const id in users) {
        if (toUserUuid && users[id].uuid === toUserUuid) {
          users[id].callStatus = CALL_STATUSES.HW_REJECTED;
          users[id].room = null;
          if (users[id].recordId) {
            const usersRecord = {
              recordId: users[id].recordId,
              doctorId: users[id].uuid,
              roomId,
              callStatus: CALL_STATUSES.UNSUCCESS,
              reason
            }
            await updateCallRecordOfWebrtc(usersRecord);
            recordUpdated = true;
          }
          emitAllUserStatus();
          setTimeout(() => {
            if (!users[id]) return;
            users[id].callStatus = CALL_STATUSES.IDLE;
            emitAllUserStatus();
          }, 2000);
          io.to(id).emit("hw_call_reject", "app");
        }
      }
      if (!recordUpdated && toUserUuid) {
        await updateCallRecordOfWebrtc({
          doctorId: toUserUuid,
          roomId,
          nurseId: users[socket.id]?.uuid,
          callStatus: CALL_STATUSES.UNSUCCESS,
          reason,
          findOpen: true
        });
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
      const { visitId, doctorId, calltype } = dataIds;
      const callStatus = CALL_STATUSES.CALLING;
      let record = await createCallRecordOfWebrtc(doctorId, nurseId, roomId, visitId, callStatus, calltype);
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
      } catch (error) {
        console.error("Error fetching user settings:", error);
      }
      const deviceRegToken = 'd2G8oVRKRAeTt2cIp8Y84D:APA91bGEW312VsT1EwsO1SRUa-HabA5KZhWGjYj5PYEeMcbLjaZE-ebMr3M2WFV7P5boTf3-b6VQ6IQLHfK-PeaRl65TCluRO9L7oum2vutcp2ZYxp1cfUw';

      sendCloudNotification({
        title: "",
        body: "",
        regTokens: [deviceRegToken],
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
          device_token: deviceRegToken,
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
      try {
        const unreadcount = await sequelize.query(
          "SELECT COUNT(sm.message) AS unread FROM supportmessages sm WHERE sm.to = 'System Administrator' AND sm.isRead = 0",
          { type: QueryTypes.SELECT }
        );
        socket.emit("adminUnreadCount", unreadcount[0].unread);
      } catch (err) {
        console.error("getAdminUnreadCount error:", err.message);
        socket.emit("adminUnreadCount", 0);
      }
    });

    socket.on("getDoctorAdminUnreadCount", async function (data) {      
      try {
        const unreadcount = await sequelize.query(
          "SELECT COUNT(sm.message) AS unread FROM supportmessages sm WHERE sm.to = :toUser AND sm.isRead = 0",
          {
            replacements: { toUser: data },
            type: QueryTypes.SELECT,
          }
        );
        socket.emit("doctorAdminUnreadCount", unreadcount[0].unread);
      } catch (err) {
        console.error("getDoctorAdminUnreadCount error:", err.message);
        socket.emit("doctorAdminUnreadCount", 0);
      }
    });

    socket.on("getDrUnreadCount", async function (data) {
      try {
        const unreadcount = await sequelize.query(
          "SELECT COUNT(m.message) AS unread FROM messages m WHERE m.toUser = :toUser AND m.isRead = 0",
          {
            replacements: { toUser: data },
            type: QueryTypes.SELECT,
          }
        );
        socket.emit("drUnreadCount", unreadcount[0].unread);
      } catch (err) {
        console.error("getDrUnreadCount error:", err.message);
        socket.emit("drUnreadCount", 0);
      }
    });
  });

  global.io = io;
};
