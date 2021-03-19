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
  global.io = io;
};
