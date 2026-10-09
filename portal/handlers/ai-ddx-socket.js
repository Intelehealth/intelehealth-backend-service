const aiDdxService = require("../services/ai-ddx.service");
const { logStream } = require("../logger/index");

const STATUS_EVENT = "ai_ddx_status";
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

const roomFor = (visitUuid) => `ai_ddx:${visitUuid}`;

const statusPayload = (visitUuid, status) => ({ visitUuid, status: status || "not_found" });

const registerAiDdxSocket = (socket) => {
  socket.on("ai_ddx_watch", async (data) => {
    const visitUuid = data?.visitUuid;
    if (typeof visitUuid !== "string" || !UUID_PATTERN.test(visitUuid)) {
      return;
    }
    socket.join(roomFor(visitUuid));
    try {
      const status = await aiDdxService.getStatus(visitUuid);
      if (status !== "pending") {
        socket.emit(STATUS_EVENT, statusPayload(visitUuid, status));
      }
    } catch (err) {
      logStream("error", `ai_ddx_watch ${visitUuid} failed: ${err.message}`, "AiDdx");
    }
  });

  socket.on("ai_ddx_unwatch", (data) => {
    const visitUuid = data?.visitUuid;
    if (typeof visitUuid === "string") {
      socket.leave(roomFor(visitUuid));
    }
  });
};

const emitAiDdxStatus = (visitUuid, status) => {
  if (!global.io) {
    return;
  }
  global.io.to(roomFor(visitUuid)).emit(STATUS_EVENT, statusPayload(visitUuid, status));
};

module.exports = { registerAiDdxSocket, emitAiDdxStatus };
