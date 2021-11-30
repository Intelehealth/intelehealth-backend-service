// const { sendCloudNotification } = require("./helper");
const { user_settings } = require("../models");
const admin = require("firebase-admin");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];

admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: "hand-in-hand-c6a7d",
    private_key_id: "a35db86e1e59b9b99e36850a67fd81a5211cda10",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDKhREg8KyoCCla\nghFpc91XUNauys2Y951v9uwhhWtVl+AH86shOd4ITxK+0DkTzZqHGtGtoZ7qSpEY\n952lT9O/rN1ld0FvNdI2P3jNgo7lQPawWEM8HcP9CsTx/VWpfkSsmDDQDmktUzai\nFctwRLiLzcAybwnU/GsUJbaIYWhCElqdmt/FiThaBOnnmvdhBRvu7abM5LTA0Jkp\ns9DXPx0toyK137wldi77Tny4/2fSZiw2G53FawNprMvM2bz0e7FBb/zcVH+HBIEY\nsBbcMa9YTC3b9/auvwrGU/wH0FqiH4HX6sX4jXx42VdE+8IUayPzivYl/rcxko6Y\n78C8KVoDAgMBAAECggEAKhIrpUKqM3wCjz1O/a+mryFpf8U8ocbqy1wp4KrVSeIz\nlaNOjSf20pYOqFocSVtgeymcnmvhVf2ol920v6dOL1brZU05aC9vnHpiD5tMMR7m\nQGsNiJsMYHBQyo6csYm8HXi+RzJ/Mf3D7zcE3K1CAzT6dN+xVLAdVIGjIkDOBk9o\nLMdPzJQYpPbkMUu75Dc9bwJz5yVo9ZNB1ZoFatxTfZeeJhh4MlnDyGOAKhonolb8\nZs5xzxRSIDskojc9vIM21PUDrlX9qSrGwFgOQpUQTWvEkbKpHOJFE6Z8leLgnUTh\nQWBaHYUwKh9S1vIqLdjZ7PgZOXUQvfALicygs6hggQKBgQDmPwiYePzA9ljSqmTe\nVK/tvIXolweBTH7AxkqS28JvgxEzgtO/zn28ZsxNtXYw7Ybg3FXwYyvGsRwfpGDR\nahdm+yZz9ngRRe2etNI/ZoUcrRgEt8dk0CxiTE/JBcOwE3NSNOSnU9xRiZ33iLOw\n5yWkUanS1wOVqGml9jt5JBLqgwKBgQDhLBplPHlDiaBavXY7pcRExApUNpw+DOfo\nfJxIp9NkuD9fhwL0XGyahAzW6uW97mwSS6AdevPNnDa87I6yBn7j/WOYAmH5GwhG\ni2n2lhNpTSglPYOBkON1GP0/Nr829cznV43aUFpNMrCMb4j3B8baG9HPN+KF3JhI\nPqqkkmq6gQKBgG8RLRZQFq0GqOZGqA3QEGXAMWB3qnkm62YWwVaCiBK+yQduLrMx\n6tl9RUSfKnqDujKyVwp07GMWgJiK9OFQKiXVNUFvPZAniW6rj1hiHggtP47XEGqD\nOUXZxgsUqsc/OrwHI93LyFXU6szDttq5RiEz+5XnfqUs7nnOg/X1/uH9AoGAclVP\njcn4FOgD6S88oqrYDsawK/SSvxsUgkMLpAS7XPAFFb9bK7LmXkrgrhwVzawLafrG\ncVGmC+ffD2zaQ+Dye1eFQ4EqOC+WsyNFCbVIY/aOhOJILPjh1ep7ZKaqzwBeK7WU\nTJ7ySzKK3LQhirWDLepkTWCl/6x0EnLneKrz0IECgYAehPp5CRT237cpmWhdE7UM\n9RYrTyUI/k94WNRPVO69TdlF/Ja6SoE5EhNUwlPRh6RtedmI5K2aPQBZ0G06EJpj\nhAZT6vhVaiZbbrOkVhqcf1FKX26nWqko1xTTYhCemsbsrbvSVULNI+V2pP5nRrc7\nzJe0JkcxjK2KdCGxiNY6xw==\n-----END PRIVATE KEY-----\n",
    client_email:
      "firebase-adminsdk-6wa92@hand-in-hand-c6a7d.iam.gserviceaccount.com",
    client_id: "103251477383160650012",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-6wa92%40hand-in-hand-c6a7d.iam.gserviceaccount.com",
  }),
  databaseURL:
    "https://hand-in-hand-c6a7d-default-rtdb.asia-southeast1.firebasedatabase.app",
});

module.exports = function (server) {
  const db = admin.database();
  const DB_NAME = `${config.domain.replace(/\./g, "_")}/rtc_notify`;
  // const DB_NAME = "rtc_notify_dev";
  console.log("DB_NAME:>>>>>>> ", DB_NAME);

  const rtcNotifyRef = db.ref(DB_NAME);
  const io = require("socket.io")(server);
  io.origins('*:*');
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
      console.log("room: ", room);
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
        io.sockets.in(room).emit("log", ["no_answer", data]);
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
      const { nurseId, doctorName, roomId } = dataIds;
      console.log("dataIds: ", dataIds);
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
        data = await user_settings.findOne({
          where: { user_uuid: nurseId },
        });
        // if (data && data.device_reg_token) {
        //   const response = await sendCloudNotification({
        //     title: "Incoming call",
        //     body: "Doctor is trying to call you.",
        //     data: {
        //       ...dataIds,
        //       actionType: "VIDEO_CALL",
        //       timestamp: Date.now(),
        //     },
        //     regTokens: [data.device_reg_token],
        //   }).catch((err) => {
        //     console.log("err: ", err);
        //   });
        //   io.sockets.emit("log", ["notification response", response, data]);
        // } else {
        //   io.sockets.emit("log", [
        //     `data/device reg token not found in db for ${nurseId}`,
        //     data,
        //   ]);
        // }
      }
      console.log(nurseId, "----<<>>>");

      await rtcNotifyRef.update({
        [nurseId]: {
          // TEXT_CHAT: {
          //   fromUser: "454554-3333-jjfjf-444",
          //   patientId: "dgddh747744-44848404",
          //   patientName: "743747444-448480404",
          //   timestamp: Date.now(),
          //   toUser: "ererere-335-33-84884jj0990",
          //   visitId: "4784847333-22-dddu40044",
          // },
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
