const { user_settings } = require("../models");
const { sendCloudNotification } = require("../handlers/helper");
const { createCallRecordOfWebrtc, updateCallRecordOfWebrtc } = require("./call_data.service");

const CALL_STATUSES = {
  CALLING: "calling",
  IN_CALL: "in_call",
  DR_REJECTED: "dr_rejected",
  HW_REJECTED: "hw_rejected",
  DR_CANCELLED: "dr_cancelled",
  HW_CANCELLED: "hw_cancelled",
  IDLE: "available",
  SUCCESS: "success",
  UNSUCCESS: "failure",
};

function generateUUID() {
  let d = new Date().getTime();
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    d += performance.now();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

module.exports = function () {
  if (!global.io) {
    throw new Error("webrtc.service: require this AFTER handlers/socket.js (global.io missing)");
  }

  const hw = global.io.of("/hw");
  global.hwUsers = {};

  function emitAllHwUsers() {
    const allHwUsers = Object.keys(global.hwUsers).map((key) => ({
      ...global.hwUsers[key],
      socketId: key,
    }));
    hw.emit("allHwUsers", allHwUsers);
  }

  hw.on("connection", (socket) => {
    if (!global.hwUsers[socket.id]) {
      global.hwUsers[socket.id] = {
        uuid: socket.handshake.query.userId,
        status: "online",
        name: socket.handshake.query.name,
        callStatus: CALL_STATUSES.IDLE,
      };
    }
    emitAllHwUsers();

    socket.on("disconnect", async (data) => {
      const u = global.hwUsers[socket.id];
      if (u && u.callStatus === CALL_STATUSES.CALLING && u.recordId) {
        await updateCallRecordOfWebrtc({
          recordId: u.recordId,
          doctorId: u.uuid,
          roomId: u.room,
          callStatus: CALL_STATUSES.UNSUCCESS,
          reason: data === "transport error" ? "Internet disconnected/Weak network" : "No internet",
        });
      }
      delete global.hwUsers[socket.id];
      emitAllHwUsers();
    });

    socket.on("call", async function (dataIds) {
      const { nurseId, doctorName, roomId, visitId, doctorId, calltype } = dataIds;

      if (global.hwUsers[socket.id]) {
        global.hwUsers[socket.id].callStatus = CALL_STATUSES.CALLING;
        global.hwUsers[socket.id].room = roomId;
        global.hwUsers[socket.id].nurseId = nurseId;
      }

      const record = await createCallRecordOfWebrtc(
        doctorId, nurseId, roomId, visitId, CALL_STATUSES.CALLING, calltype
      );
      if (global.hwUsers[socket.id]) {
        global.hwUsers[socket.id].recordId = record?.data?.id;
      }

      for (const id in global.hwUsers) {
        if (global.hwUsers[id].uuid === nurseId) {
          hw.to(id).emit("call", dataIds);
          global.hwUsers[id].callStatus = CALL_STATUSES.CALLING;
          global.hwUsers[id].room = roomId;

          setTimeout(() => {
            for (const sid in global.hwUsers) {
              if (
                global.hwUsers[sid] &&
                global.hwUsers[sid].room === roomId &&
                global.hwUsers[sid].callStatus === CALL_STATUSES.CALLING
              ) {
                global.hwUsers[sid].callStatus = CALL_STATUSES.IDLE;
                global.hwUsers[sid].room = null;
              }
            }
            emitAllHwUsers();
          }, 610000);
        }
      }
      emitAllHwUsers();

      try {
        const settings = await user_settings.findOne({ where: { user_uuid: nurseId } });
        if (settings?.device_reg_token) {
          sendCloudNotification({
            regTokens: [settings.device_reg_token],
            data: {
              id: generateUUID(),
              ...dataIds,
              doctorName,
              nurseId,
              roomId,
              type: "video_call",
              timestamp: Date.now().toString(),
              device_token: settings.device_reg_token,
            },
          });
        }
      } catch {}
    });
  });
};
