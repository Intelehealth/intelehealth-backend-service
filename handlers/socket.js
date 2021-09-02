const { sendCloudNotification } = require("./helper");
const { user_settings } = require("../models");

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: "intelehealth-unicef",
    private_key_id: "299a8d7f8a9b9d3baac30967bfcda70a60cc6e8a",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC3wfq2y3hSrwU9\nqqAZfq7M0BilvhgNAuYV63o7uzoY+YagIGWk7WPveZq2r2MpdX6mc1PtpjfVadKW\nONXAO3dWTl9AC/02UQP10LlU2aMJ759mC+K+Se5k284X++f7xUWGXuaFGoPm9itf\nwL0Khwv4ph9vaIdlyKREWBq+icOnCoPX8RkdrWVaKSLsC5+BB7kYRnrqi2greFRS\nIj+qAyc1fEr9VfJFMMNTi0lQwr4egGanNvU9x/oyHT6xpnDVxrsrnXDjVvVRnKSv\nd8/msu9LvMjwQr1GtXLuIKhwFqlVnMSFPt+S8GdHPBpXm+65JnFbWmTgjFWF62v4\nCqwHdbRLAgMBAAECggEAJ54NQTLN/rmYPirWuJhs9GBbKAS7Z7a7x3cM0+ryRCcs\nBMLnVy8NMDi+B+v5S5t20kkkC6Ud/YeCrPuU7gyEFpnwBD1xeq/t1CYLhwUjFwXQ\nDm66lH8ZBCq1nMslQU1PR4CXX5QPYxCo2kySFT53cMTUGy9knaer7sY2AeVuxsjq\nYVsgyeasBNaGeHZCmC1jRcMYxVSdiujY6dRtd/dJCP3p1q/wv3al1flhy9NBRNFz\n8UkHguRVOD+gq1E9gmbbSHQhkeJs0FY7rxFnJ/3DA1VS0lVHVfbxUoWtcfhDWDag\n+Lpi4bl1SEwitin++bpny5wMQWmG56wX4KjDh2CuJQKBgQDmZD3DQT6k+EibIEVq\n2TFA4cS0DRbqfzkqm/CyNLDkurSN3HIraURHgXU+82oRUmlCH9tkIcUxP43TaZzN\nz9veiQh3odakrCYvh9XvX2BGVCYMvfKTQc6X7WsJoQjecRBrA5+aJX2afDv0Omyc\n6SsS2EgFIGiHcXFqPEvbNYw/PwKBgQDMLsdvUQYAxiIFmXJtLR1wbbAj92JWvt/I\nhdt3zMzR1+GRuYVUBOQGsZ+f5heMNeDK69dfJBzM8OoMIpR/SqakzrpxBoI7YUY6\nEPAUcrAWBwdF5oXx2TtoVXT8Cr/TF3Xs0877uJQAVZsPBFv4GwUwVCFsbxemq2Ho\npO6d8RST9QKBgCP+n0OlKuNdQwKxbQb/fdl0LGYw8Vabn9PPXzCIWOazYMgVG+U6\nYgeF60p1fynLpVRGY+FmAUfrdP4FrxDcm65N3HvMVhuOJb0hTMREM2dpeDRfbMmi\n62MDHcj4VsliAr2laEcN+myrYjaK9jMhnrAoCEB8yrf2elCtsPBDknDDAoGATLOJ\n8bQjKClF4IqbJI4dD/30fB5TT7jWQfKe1isWCgIp1180ybIooqcZCq0ZzW7z6eac\nej4Ln6UklrhqxkKZxTFvckP6qinJgsiYF2ZZ5Xxwa/7D9G0hVvk7P+8dzkNy5itP\nBtp4poOCAyslDVfBJD2GbMByxwZ8ejNy+9vzWf0CgYEAuorZkFgXjzwEVrGaL8Gf\nFuvW/afxkps49VDaOSRgn5hxor+q/zHPeHYmHahys5Li8jC0PqC6D7/ORb9+fft/\nZDadMFNZRsNzTIlxiUNyBQU20R1xL/dGAgI52nigybJczw2nPRhTmP8DDB07rpDm\n2r/JELlJX8QaEzqUw3lJAvI=\n-----END PRIVATE KEY-----\n",
    client_email:
      "firebase-adminsdk-xiz7j@intelehealth-unicef.iam.gserviceaccount.com",
    client_id: "116314458649162738909",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xiz7j%40intelehealth-unicef.iam.gserviceaccount.com",
  }),
  databaseURL:
    "https://intelehealth-unicef-default-rtdb.asia-southeast1.firebasedatabase.app",
  authDomain: "intelehealth-unicef.firebaseapp.com",
});

module.exports = function (server) {
  const db = admin.database();
  const rtcNotifyRef = db.ref("rtc_notify");
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
        socket.emit("toast", {
          duration: 2000,
          message:
            "Not able to reach the health worker at this moment. Please try again after sometime.",
        });
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
