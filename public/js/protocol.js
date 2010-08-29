var protocol = {};

protocol.Types = {
  GameState:0,
  Users:1,
  Snakes:2
};

protocol.newMessage = function(type,data) {
  return {type:type,data:data};
}

protocol.messageData = function(message) {
  if ("data" in message) {
    return message.data;
  }
  else {
    console.error("message didn't contain data");
    return "";
  }
}

protocol.messageType = function(message) {
  if ("type" in message) {
    return message.type;
  }
  else {
    console.log("message didn't contain type");
    return "";
  }
}

protocol.GameClient = function(ioClient) {this.init(ioClient)};
protocol.GameClient.prototype = {
  init: function(newioClient) {
    this.ioClient = newioClient;
  },
  
  send: function(data) {
    this.ioClient.send(protocol.newMessage(protocol.Types.GameState, data));
  },
  
  //this method should be overriden by the game client to do custom code when it recieves data
  receive: function(data) {
    this.send("pong");//test
    console.log("recieved message from browser, but game client hasn't overriden receive yet");
  }
};

exports.protocol = protocol;