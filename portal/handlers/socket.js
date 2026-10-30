const { user_settings } = require("../models");
const { sequelize } = require("../models");
const { QueryTypes } = require("sequelize");
const { getFirebaseAdmin, sendCloudNotification } = require("./helper");
const { deliveredById } = require("../services/message.service");
const { createCallRecordOfWebrtc, createClosedCallRecord, updateCallRecordOfWebrtc, getOpenCallStatus } = require("../services/call_data.service")
const { CALL_DATA_STATUS, WEBAPP_PRE_CALL_OUTCOMES, WEBAPP_CALL_OUTCOMES } = require("../constants/call-outcomes");
const { createCallRecordOfWebrtc, createClosedCallRecord, updateCallRecordOfWebrtc, getOpenCallStatus } = require("../services/call_data.service")
const { CALL_DATA_STATUS, WEBAPP_PRE_CALL_OUTCOMES, WEBAPP_CALL_OUTCOMES } = require("../constants/call-outcomes");
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

// socket.io disconnect reason of the doctor's socket -> call outcome, before and after connecting.
const DISCONNECT_OUTCOMES = {
  "transport error": { ringing: "networkUnavailable", connected: "networkLostInCall" },
  "ping timeout": { ringing: "networkUnavailable", connected: "networkLostInCall" },
  "transport close": { ringing: "connectionClosed", connected: "doctorDisconnectedInCall" },
  "client namespace disconnect": { ringing: "doctorLeftPage", connected: "doctorDisconnectedInCall" },
};

// Reasons after which the client opens a new socket by itself (reconnect, page re-creating it).
const RECONNECTING_REASONS = ["transport error", "ping timeout", "client namespace disconnect"];

// How long a call waits for the doctor's new socket before it is closed. Longer once connected,
// since the LiveKit call itself can outlive a socket.io reconnect.
const RECONNECT_GRACE_MS = 5000;
const RECONNECT_GRACE_IN_CALL_MS = 30000;

// A ringing call with no outcome after this long is recorded as unknown.
const UNRESOLVED_CALL_MS = 11 * 60 * 1000;

// callAttemptId (sent by the doctor webapp) -> Promise of the call_data id, so every event of
// one attempt reaches the same row even after the doctor's socket changed.
const attemptRecords = new Map();
const ATTEMPT_TTL_MS = 3 * 60 * 60 * 1000;

function rememberAttempt(attemptId, recordIdPromise) {
  if (!attemptId) return;
  attemptRecords.set(attemptId, recordIdPromise);
  setTimeout(() => attemptRecords.delete(attemptId), ATTEMPT_TTL_MS).unref?.();
}

async function attemptRecordId(attemptId) {
  return attemptId && attemptRecords.has(attemptId) ? attemptRecords.get(attemptId) : undefined;
}

// endedBy sent by the doctor webapp with bye -> call outcome.
const BYE_OUTCOMES = {
  doctor: "doctorEnded",
  hw: "hwEnded",
  network: "networkLostInCall",
  dropped: "callDropped",
};

/**
 * Whether a sendCloudNotification result shows the push was not sent. It returns undefined when
 * the request failed; a per-token failure does not throw but is in result.responses.
 */
function pushFailed(result) {
  return !result || result.responses?.[0]?.success === false;
}

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

      const inCall = user?.callStatus === CALL_STATUSES.IN_CALL;
      if ((user?.callStatus === CALL_STATUSES.CALLING || inCall) && user.recordId) {
        setTimeout(() => {
          handOverOrFailCall(user, data, disconnectedAt).catch((error) =>
            console.error("Error closing call after disconnect:", error)
          );
        }, inCall ? RECONNECT_GRACE_IN_CALL_MS : RECONNECT_GRACE_MS);
      }
    });

    /**
     * A doctor's socket dropped during their call. If the same doctor came back on a new
     * socket, move the call to it so later events (bye, cancel, time up) still find the record;
     * otherwise close the call with an outcome matching the disconnect reason.
     */
    async function handOverOrFailCall(user, reason, disconnectedAt) {
      const openStatus = await getOpenCallStatus(user.recordId);
      if (!openStatus) return;

      if (RECONNECTING_REASONS.includes(reason)) {
        const newSocketId = Object.keys(users).find((id) =>
          users[id].uuid === user.uuid &&
          !users[id].recordId &&
          users[id].connectedAt >= disconnectedAt - 1000
        );
        if (newSocketId) {
          // A connected call's later events find the row by callAttemptId, so its socket
          // state is left as is; a ringing call needs it for cancel and time up.
          if (openStatus === CALL_DATA_STATUS.CALLING) {
            Object.assign(users[newSocketId], {
              recordId: user.recordId,
              room: user.room,
              nurseId: user.nurseId,
              callStatus: user.callStatus,
            });
            emitAllUserStatus();
          }
          return;
        }
      }

      const connected = openStatus === CALL_DATA_STATUS.SUCCESS;
      const mapped = DISCONNECT_OUTCOMES[reason];
      await updateCallRecordOfWebrtc({
        recordId: user.recordId,
        outcome: mapped ? mapped[connected ? "connected" : "ringing"] : (connected ? "callDropped" : "unknown"),
      });
    }

    /**
     * call_data id of the attempt an event belongs to: the webapp's callAttemptId first, then
     * the socket that placed the call (waiting for its row if still being created).
     */
    async function recordIdFor(attemptId, socketUser) {
      const fromAttempt = await attemptRecordId(attemptId);
      if (fromAttempt) return fromAttempt;
      if (socketUser?.recordPromise) await socketUser.recordPromise;
      return socketUser?.recordId;
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
        if (users[socketId]) {
          users[socketId].callStatus = CALL_STATUSES.IN_CALL;
          users[socketId].room = roomId;
          users[socketId].nurseId = nurseId;
        }
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

        if (data.appSocketId && users[data.appSocketId]) {
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
        if (data?.initiator !== "hw") {
          const outcome = data?.webapp ? (BYE_OUTCOMES[data?.endedBy] || "endedNormally") : "hwEnded";
          const doctorId = data?.doctorId || socketUser?.uuid;
          const roomId = data?.doctorId ? data?.roomId : socketUser?.room;
          const recordId = await recordIdFor(data?.callAttemptId, socketUser);
          if (recordId || doctorId) {
            await updateCallRecordOfWebrtc({
              recordId,
              doctorId,
              nurseId: data?.nurseId,
              roomId,
              outcome,
              findOpen: Boolean(roomId),
            });
          }
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
      if (data?.initiator !== "hw") {
        const socketUser = users[data?.socketId];
        const recordId = await recordIdFor(data?.callAttemptId, socketUser);
        await updateCallRecordOfWebrtc({
          recordId,
          doctorId: data?.doctorId || socketUser?.uuid,
          roomId: data?.roomId || socketUser?.room,
          outcome: "connected",
          findOpen: true,
        });
      }
      markConnected(data);
    });

    // HW-to-doctor calls (create_or_join_hw) have no call_data row, so cancel_hw and
    // dr_call_reject only update socket state. Writing to users[id].recordId here would have
    // changed the doctor's previous call.
    socket.on("cancel_hw", async function (data) {
      for (const id in users) {
        if (users[id].uuid === data?.connectToDrId) {
          users[id].callStatus = CALL_STATUSES.HW_CANCELLED;
          emitAllUserStatus();
          setTimeout(() => {
            if (!users[id]) return;
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
      let recordId = await attemptRecordId(data?.callAttemptId);
      for (const id in users) {
        if (data?.nurseId && users[id].uuid === data.nurseId) {
          users[id].callStatus = CALL_STATUSES.IDLE;
          users[id].room = null;
          io.to(id).emit("cancel_dr", "webapp");
        }
      }

      // Close the calling doctor's call record.
      let recordId = await attemptRecordId(data?.callAttemptId);
      for (const id in users) {
        if (data?.nurseId && users[id].nurseId === data.nurseId) {
          users[id].callStatus = CALL_STATUSES.DR_CANCELLED;
          users[id].callTerminated = true;
          // With an attempt id, the socket's recordId may belong to the doctor's previous call.
          if (!recordId && !data?.callAttemptId) recordId = await recordIdFor(undefined, users[id]);
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

      const doctorId = users[socket.id]?.uuid || data?.doctorId;
      if (recordId) {
        await updateCallRecordOfWebrtc({ recordId, outcome: "doctorCancelled" });
        return;
      }
      // An attempt id this server never saw a "call" for: the doctor cancelled before the HW
      // was called, so there is no row yet.
      if (data?.callAttemptId && data?.visitId) {
        const created = createClosedCallRecord({
          doctorId,
          nurseId: data?.nurseId,
          roomId: data?.roomId,
          visitId: data?.visitId,
          callType: data?.callType,
          outcome: "doctorCancelledImmediately"
        }).then((record) => record?.data?.id);
        rememberAttempt(data.callAttemptId, created);
        await created;
        return;
      }
      // Older webapp without attempt ids, after its socket was replaced: look the row up.
      await updateCallRecordOfWebrtc({
        doctorId,
        roomId: data?.roomId,
        nurseId: data?.nurseId,
        outcome: "doctorCancelled",
        findOpen: true
      });
    });

    /**
     * A failure the doctor webapp saw itself: before the HW was called (token API, LiveKit
     * connection; creates the row) or during ringing (media, LiveKit dropped). Only known
     * outcome keys are accepted; the stored text always comes from CALL_OUTCOMES.
     */
    socket.on("call_outcome", async function (data) {
      const outcome = data?.outcome;
      const doctorId = users[socket.id]?.uuid || data?.doctorId;
      const preCall = WEBAPP_PRE_CALL_OUTCOMES.includes(outcome);
      if (!doctorId || (!preCall && !WEBAPP_CALL_OUTCOMES.includes(outcome))) {
        console.error(`call_outcome ignored: outcome ${outcome}, doctor ${doctorId}`);
        return;
      }

      const recordId = await attemptRecordId(data?.callAttemptId);
      if (recordId) {
        await updateCallRecordOfWebrtc({ recordId, outcome });
      } else if (preCall && data?.callAttemptId) {
        const created = createClosedCallRecord({
          doctorId,
          nurseId: data?.nurseId,
          roomId: data?.roomId,
          visitId: data?.visitId,
          callType: data?.callType,
          outcome
        }).then((record) => record?.data?.id);
        rememberAttempt(data.callAttemptId, created);
        await created;
      } else {
        await updateCallRecordOfWebrtc({ doctorId, roomId: data?.roomId, outcome, findOpen: true });
      }
    });

    socket.on("call_time_up", async function (toUserUuid) {
      let recordId;
      for (const id in users) {
        if (toUserUuid && users[id].nurseId === toUserUuid) {
          users[id].callStatus = CALL_STATUSES.IDLE;
          users[id].callTerminated = true;
          if (!recordId) recordId = await recordIdFor(undefined, users[id]);
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
      if (toUserUuid) {
        await updateCallRecordOfWebrtc({
          recordId,
          doctorId: users[socket.id]?.uuid,
          nurseId: toUserUuid,
          outcome: "noAnswer",
          findOpen: true
        });
      }
    });

    socket.on("hw_call_reject", async function (toUserUuid) {
      // Sent by the HW's app with the doctor's uuid.
      const roomId = users[socket.id]?.room;
      const hwUuid = users[socket.id]?.uuid;
      let recordId;
      for (const id in users) {
        if (toUserUuid && users[id].uuid === toUserUuid) {
          // The doctor's socket that placed this call; other tabs of the doctor hold older calls.
          if (!recordId && hwUuid && users[id].nurseId === hwUuid) {
            recordId = await recordIdFor(undefined, users[id]);
          }
          users[id].callStatus = CALL_STATUSES.HW_REJECTED;
          users[id].room = null;
          emitAllUserStatus();
          setTimeout(() => {
            if (!users[id]) return;
            users[id].callStatus = CALL_STATUSES.IDLE;
            emitAllUserStatus();
          }, 2000);
          io.to(id).emit("hw_call_reject", "app");
        }
      }
      // The HW is free again. The doctor webapp used to do this through a bye after the reject.
      for (const id in users) {
        if (hwUuid && users[id].uuid === hwUuid) {
          users[id].callStatus = CALL_STATUSES.IDLE;
          users[id].room = null;
        }
      }
      emitAllUserStatus();
      if (toUserUuid) {
        await updateCallRecordOfWebrtc({
          recordId,
          doctorId: toUserUuid,
          roomId,
          nurseId: hwUuid,
          outcome: "hwRejected",
          findOpen: true
        });
      }
    });

    socket.on("dr_call_reject", async function (toUserUuid) {
      for (const id in users) {
        if (users[id].uuid === toUserUuid) {
          users[id].callStatus = CALL_STATUSES.DR_REJECTED;
          users[id].room = null;
          emitAllUserStatus();
          setTimeout(() => {
            if (!users[id]) return;
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
      const { nurseId, doctorName, roomId, callAttemptId } = dataIds;
      let isCalling = false;
      users[socket.id].callStatus = CALL_STATUSES.CALLING;
      users[socket.id].room = roomId;
      users[socket.id].nurseId = nurseId;
      const { visitId, doctorId } = dataIds;
      // The doctor webapp sends callType; calltype is kept for older clients.
      const calltype = dataIds.callType || dataIds.calltype;
      const callStatus = CALL_STATUSES.CALLING;
      // Events of this attempt (cancel, connected) can arrive while the row is still being created.
      const recordPromise = createCallRecordOfWebrtc(doctorId, nurseId, roomId, visitId, callStatus, calltype)
        .then((record) => record?.data?.id);
      users[socket.id].recordPromise = recordPromise;
      rememberAttempt(callAttemptId, recordPromise);
      const recordId = await recordPromise;
      if (users[socket.id]) users[socket.id].recordId = recordId;
      if (recordId) {
        setTimeout(() => {
          updateCallRecordOfWebrtc({ recordId, outcome: "unknown" });
        }, UNRESOLVED_CALL_MS).unref?.();
      }
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

      let deliveryIssue = null;
      if (!data?.device_reg_token) {
        deliveryIssue = "pushFailed";
      } else {
        const pushResult = await sendCloudNotification({
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
            device_token: data?.device_reg_token || '',
          },
        });
        if (pushFailed(pushResult)) deliveryIssue = "pushFailed";
      }
      if (deliveryIssue) {
        console.error(`Call push to HW ${nurseId} (call_data ${recordId}) not sent: ${data?.device_reg_token ? "push request failed" : "no push token"}`);
      }

      const reachedOnHwWebapp = Object.values(global.hwUsers || {}).some((hwUser) =>
        hwUser.room === roomId && hwUser.callStatus === CALL_STATUSES.CALLING && hwUser.uuid !== doctorId
      );
      if (recordId && !isCalling && !reachedOnHwWebapp) {
        await updateCallRecordOfWebrtc({ recordId, outcome: deliveryIssue || "hwNotAvailable" });
      }

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
