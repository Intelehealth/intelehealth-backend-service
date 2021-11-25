const { user_settings } = require("../models");
const admin = require("firebase-admin");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];

admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: "intelehealth-3-0",
    private_key_id: "8f42f95d88efd80e27b003e0d6bf687c0f450213",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC2edZlb/COtScM\ntZF6H8ZyNh4qykJ1Rl+z7RsZmG41Ajla7i0DHpYGWwlM5GZM6B/H7fPdPAciin+w\nDu3vw8J2IndRTxxyS2jD9LasAQy7xdVV0FQhpW+uB6mNC0lYknGBEsZD5vaLeO2x\nXwIR8fNyuHtG2WU+ZUFa2m982wlXvOhC6R4IsIkEGkc4xtf6pZt0flnKByWjdoxk\nS5Pk/nkf9aygwjnQ64fuGc9Eh+ClLtufuXSsnN6VHmQcE0SHYrl6y2tiGyU9TIOX\nWsIphS/+KS6rqJWL9rW3s9kc41O/4SlVV9ULTury0eKWp35INWBHgRcLxq5TvrHa\nQ5pRM/m1AgMBAAECggEAHeY/2ZYqeg+3ys7TfAnJ1/wDHGrQ0euKke5Xgu2lnTz0\njfA54ul3lqoDD5zbIF3mmzljvIvx9VhxTLVdimxuqDHEkEegtx+hFn66EdwILJph\ndvKwXmT/tCngP9KqHX+9ZnNflk+5dSgG9onFSpB1HgaZeIX1n3Ay8cKaAwDW+o+b\n5r9ReBD5R2euqxL3UOSR+9gcvoDlYXlRs7xzeVo9KQ4lVBr188h1dSJuSq97C8wI\nfDCyJH4zNco94H1+i0lZ3pivkjKlLxC//XSmCBmI44Rtg+DlHHEEJQ6DwWA+WmEP\nn+avu3wJukJ8Xon/5DU5VlF8FXaI+ONqi01KdKGs7wKBgQDuwgBA8ZYgoMvlYwjw\nMWY3IPaSFfib7nUF3QXzERhiRPvxu+RwME3rcZYUvc3zr3jiCSr6ItwwL4SOvgFD\nzqBDEslI/5Vnb2/e09/uRF/A6f5Whm8u6wyf39IeaT0X81ce8iuQA4y7i8IhEBD9\nzZozLHrHiElatzeD7oQ3Sb67uwKBgQDDp1VmRvNHa7v+hos/yvd+uwPi3ZsJ2/Fk\n14kpEB/Evso7ksrJQ5WVZFUEV6YV7ucc/w1wjolGBBxQk39jrC/SguLRM83JfgyJ\nJxDZhveE9lAUravm7KxTwKuVHArXsbXACHTVchaGK82xmbLG8YO9rc71LN22CNJJ\nhZNcc4fxTwKBgCkn9eU7/7X2Ic+Tx7mnukfsfbRm5yjx7Ogq1li07LAb1hYwXktc\neEIKnWVL5pGIAN1t2SOvGKeRuVblt9AZcRS+y0WzEOz4j58ohKRM0vitHTOLDuVW\njSGN8mldmLNlNfJWql2zzvGRQNB0NYmahGcn1q5IduSVSpOKbO4e3yr7AoGAIUsI\nLS9FlpGum9EpQOG428fXEXPEPhk/KnnCzUoBHemZYCnKeBUYDyPTk7mWeYT9ruF3\n1/9pPJDWgJ+Yvc0/FgNPtWmrSu44E96h72IYHHgNiHdFGTaM3HOcvvLWpX2H//Vw\nbCHN02cAyYft9AyE7nH1FaNc1u0JW5lvSfwe1eECgYABK0231xNRSdavIi6OZQ7J\nGxnESn7uJzpuH0Qz9tCuFYPOozoRMey4RlKJNiQiSv4F/iBhQCr8tHunQxF6l5N4\nnqJFnNMC2c5GTX6Z2xjeYKWP7WJKDdxLitmm1N751Qqqd4NslNQf4VaIZaxIbubw\nxoNuzih3JzCFdGWPkK8idw==\n-----END PRIVATE KEY-----\n",
    client_email:
      "firebase-adminsdk-xku2h@intelehealth-3-0.iam.gserviceaccount.com",
    client_id: "100710305442029555999",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xku2h%40intelehealth-3-0.iam.gserviceaccount.com",
  }),
  databaseURL: "https://intelehealth-3-0-default-rtdb.firebaseio.com",
});

module.exports = function (server) {
  const db = admin.database();
  const DB_NAME = `${config.domain.replace(/\./g, "_")}/rtc_notify`;
  // const DB_NAME = "rtc_notify_dev";
  console.log("DB_NAME: ", DB_NAME);

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
