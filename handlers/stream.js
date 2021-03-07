module.exports = function () {
  /**
   * available streams
   * the id value is considered unique (provided by socket.io)
   */
  const streamList = [];

  /**
   * Stream object
   */
  const Stream = function (id, name) {
    this.name = name;
    this.id = id;
  };

  return {
    addStream: function (id, name) {
      const stream = new Stream(id, name);
      streamList.push(stream);
    },

    removeStream: function (id) {
      let index = 0;
      while (index < streamList.length && streamList[index].id != id) {
        index++;
      }
      streamList.splice(index, 1);
    },

    // update function
    update: function (id, name) {
      const stream = streamList.find(function (element, i, array) {
        return element.id == id;
      });
      stream.name = name;
    },

    getStreams: function () {
      return streamList;
    },
  };
};
