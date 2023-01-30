const admin = require("firebase-admin");
// const { sendCloudNotification } = require("./helper");
const { user_settings } = require("../models");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];

const serviceAccount = require(__dirname + "/../config/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://intelehealth-unicef-default-rtdb.asia-southeast1.firebasedatabase.app"
});

module.exports = function (server) {
  const db = admin.database();
  const DB_NAME = `${config.domain.replace(/\./g, "_")}/rtc_notify`;
  // const DB_NAME = "rtc_notify_dev";
  console.log("DB_NAME:>>>>>>> ", DB_NAME);
  const rtcNotifyRef = db.ref(DB_NAME);

  const io = require("socket.io")(server);
  global.users = {};
  io.on("connection", (socket) => {
    if (!users[socket.id]) {
      users[socket.id] = {
        uuid: socket.handshake.query.userId,
        status: "online",
        name: socket.handshake.query.name,
      };
    }
    console.log("socket: >>>>>", socket.handshake.query.userId);

    socket.emit("myId", socket.id);

    io.sockets.emit("allUsers", users);

    socket.on("disconnect", () => {
      console.log("disconnected:>> ", socket.id);
      delete users[socket.id];
      io.sockets.emit("allUsers", users);
    });

    function log() {
      var array = ["Message from server:"];
      array.push.apply(array, arguments);
      socket.emit("log", array);
    }

    socket.on("create or join", function (room) {
      log("Received request to create or join room " + room);

      var clientsInRoom = io.sockets.adapter.rooms[room];
      var numClients = clientsInRoom
        ? Object.keys(clientsInRoom.sockets).length
        : 0;
      log("Room " + room + " now has " + numClients + " client(s)");
      socket.on("message", function (message) {
        log("Client said: ", message);
        io.sockets.in(room).emit("message", message);
      });

      socket.on("bye", function (data) {
        console.log("received bye");
        io.sockets.in(room).emit("message", "bye");
        io.sockets.in(room).emit("bye");
        io.sockets.emit("log", ["received bye", data]);
      });

      socket.on("no_answer", function (data) {
        console.log("no_answer");
        io.sockets.in(room).emit("bye");
        io.sockets.emit("log", ["no_answer", data]);
      });

      if (numClients === 0) {
        socket.join(room);
        log("Client ID " + socket.id + " created room " + room);
        socket.emit("created", room, socket.id);
      } else if (numClients === 1) {
        log("Client ID " + socket.id + " joined room " + room);
        io.sockets.in(room).emit("join", room);
        socket.join(room);
        socket.emit("joined", room, socket.id);
        io.sockets.in(room).emit("ready");
      } else {
        socket.emit("full", room);
      }
    });
    socket.on("call", async function (dataIds) {
      console.log('dataIds: >>>>>>>> ', dataIds);
      const { nurseId, doctorName, roomId } = dataIds;

      let isCalling = false;
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          const userObj = users[socketId];
          if (userObj.uuid === nurseId) {
            io.sockets.to(socketId).emit("call", dataIds);
            isCalling = true;
          }
        }
      }
      console.log(nurseId, "----<<>>>");
      try {
        data = await user_settings.findOne({
          where: { user_uuid: nurseId },
        });
      } catch (error) {}

      await rtcNotifyRef.update({
        [nurseId]: {
          VIDEO_CALL: {
            doctorName,
            nurseId,
            roomId,
            timestamp: Date.now(),
            device_token:
              data && data.device_reg_token ? data.device_reg_token : "",
          },
        },
      });
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
  });
  global.io = io;
};
