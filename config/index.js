module.exports = {
  LOOPBACK_CLIENT_ID: "LOOPBACK_CLIENT_ID",
  TURN_BASE_URL: "https://testing.intelehealth.org:3004",
  TURN_URL_TEMPLATE: "%s/turn",
  WSS_HOST_PORT_PAIRS: ["testing.intelehealth.org:3004"],
  RESPONSE_UNKNOWN_ROOM: "UNKNOWN_ROOM",
  RESPONSE_UNKNOWN_CLIENT: "UNKNOWN_CLIENT",
  RESPONSE_ROOM_FULL: "FULL",
  RESPONSE_DUPLICATE_CLIENT: "DUPLICATE_CLIENT",
  server: {
    host: "127.0.0.1",
    port: process.env.PORT || 4567,
  },
  CEOD_KEY: "4080218913",
  RESPONSE_SUCCESS: "SUCCESS",
  RESPONSE_ROOM_FULL: "FULL",
  RESPONSE_ERROR: "ERROR",
  WSS_HOST_ACTIVE_HOST_KEY: "wss_host_active_host",
  RESPONSE_INVALID_REQUEST: "INVALID_REQUEST",
  iceServers: [
    {
      urls: ["turn:numb.viagenie.ca"],
      username: "sultan1640@gmail.com",
      credential: "98376683",
    },
    { urls: ["stun:stun.l.google.com:19302"] },
    { urls: ["stun:stun1.l.google.com:19302"] },
  ],
};
