var protocol = {};

protocol.Types = {
  GameState:0,
  LeaderBoard:1
};

protocol.newMessage = function(type,data) {
  return {type:type,data:data};
}

protocol.messageData = function(message) {
  return message.data;
}

protocol.messageType = function(message) {
    return message.type;
}

protocol.GameClient = function(ioClient) {this.init(ioClient)};
protocol.GameClient.prototype = {
  init: function(newioClient) {
    this.ioClient = newioClient;
  },
  
  send: function(data) {
    this.ioClient.send(protocol.newMessage(protocol.Types.GameState, data));
  }
};

exports.protocol = protocol;