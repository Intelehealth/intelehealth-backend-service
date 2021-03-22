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

    /**
     * AppRTC points
     */
    socket.on("register", (data) => {
      console.log("register:data:>>>>>>>> ", data);
      io.sockets.emit("register", data);
    });

    socket.on("send", (data) => {
      console.log("send:data:----==>> ", data);
      io.sockets.emit("send", data);
    });
  });
  global.io = io;
};
