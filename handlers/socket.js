const moment = require("moment");
const { sendCloudNotification } = require("./helper");
const { user_settings } = require("../models");
const { connect, disconnect } = require("../services/analytic.service");

function replaceAll(str, find, replace) {
  const arr = str.split(find);
  return arr.join(replace);
}

module.exports = function (server) {
  const io = require("socket.io")(server);
  global.users = {};
  io.on("connection", async (socket) => {
    if (!users[socket.id]) {
      let name = socket.handshake.query.name || "";
      let device = socket.handshake.query.device || "";
      let userType = socket.handshake.query.userType || "";
      name = replaceAll(name, "+", " ");
      device = replaceAll(device, "+", " ");
      userType = replaceAll(userType, "+", " ");
      const uuid =
        socket.handshake.query.userId || socket.handshake.query.userUuid;
      users[socket.id] = {
        uuid,
        status: "online",
        name,
        device,
        userType,
        loginAt: moment("2022-02-16T14:31:59+05:30"),
      };
      await connect(users[socket.id]);
    }

    socket.emit("myId", socket.id);

    io.sockets.emit("allUsers", users);

    socket.on("disconnect", async () => {
      console.log("disconnected:>> ", socket.id);
      try {
        await disconnect(users[socket.id]);
      } catch (error) {
        console.log("error: ", error);
      }
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
      const { nurseId } = dataIds;
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
      if (!isCalling) {
        const data = await user_settings.findOne({
          where: { user_uuid: nurseId },
        });
        if (data && data.device_reg_token) {
          const response = await sendCloudNotification({
            title: "Incoming call",
            body: "Doctor is trying to call you.",
            data: { ...dataIds, actionType: "VIDEO_CALL" },
            regTokens: [data.device_reg_token],
          }).catch((err) => {
            console.log("err: ", err);
          });
          io.sockets.emit("log", ["notification response", response, data]);
        } else {
          io.sockets.emit("log", [
            `data/device reg token not found in db for ${nurseId}`,
            data,
          ]);
        }
      }
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
