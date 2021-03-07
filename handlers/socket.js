const Stream = require("../handlers/stream");

module.exports = function (server) {
  const io = require("socket.io")(server);
  let users = {};
  io.on("connection", (socket) => {
    if (!users[socket.id]) {
      users[socket.id] = socket.id;
    }

    socket.emit("myId", socket.id);

    io.sockets.emit("allUsers", users);

    socket.on("disconnect", () => {
      delete users[socket.id];
    });

    socket.on("callUser", (data) => {
      io.to(data.userToCall).emit("hey", {
        signal: data.signalData,
        from: data.from,
      });
    });

    socket.on("acceptCall", (data) => {
      io.to(data.to).emit("callAccepted", data.signal);
    });
  });

  // io.on("connection", function (client) {
  //   console.log("-- " + client.id + " joined --");
  //   client.emit("id", client.id);
  //   streams.addStream(client.id);
  //   io.sockets.emit("activeUsers", {
  //     users: streams.getStreams(),
  //   });

  //   client.on("candidate", (data) => {
  //     console.log("data: ", data);
  //     io.to(data.to).emit("new-candidate", {
  //       id: client.id,
  //       candidate: data.candidate,
  //     });
  //   });

  //   client.on("answer", (data) => {
  //     io.to(data.to).emit("answer-made", {
  //       id: client.id,
  //       answer: data.answer,
  //     });
  //   });

  //   client.on("call", function (options) {
  //     console.log("-- " + client.id + " is ready to stream --");
  //     io.to(options.to).emit("calling", {
  //       offer: options.offer,
  //       id: client.id,
  //     });
  //   });

  //   client.on("update", function (options) {
  //     streams.update(client.id, options.name);
  //   });

  //   function leave() {
  //     console.log("-- " + client.id + " left --");
  //     streams.removeStream(client.id);
  //   }

  //   client.on("disconnect", leave);
  //   client.on("leave", leave);
  // });
  // global.streams = new Stream();
};
