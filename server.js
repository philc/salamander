require("./public/js/utils");

var http = require("http"),
  url = require("url"),
  fs = require("fs"),
  sys = require("sys"),
  socket = require("./socket_node/"),
  ServerEngine = require("./public/js/engine").ServerEngine;
  protocol = require("./public/js/protocol").protocol;

var PUBLIC_DIR = "/public";

function send404(res){
  res.writeHead(404, {"Content-Type": "text/html"});
  res.write("file not found foo!");
  res.end();
};

var Utils = {
  ext: function(path) {
      var index = path.lastIndexOf(".");
      return index < 0 ? "" : path.substring(index);
  },

  extToMime: {
          ".gif"   : "image/gif"
        , ".jpg"   : "image/jpeg"
        , ".png"   : "image/png"
        , ".css"   : "text/css"
        , ".js"    : "application/javascript"
        , ".html"  : "text/html"
        , ".ico"   : "image/vnd.microsoft.icon"
  }
}

var server = http.createServer(function (req, res) {
  var path = url.parse(req.url).pathname;
  switch (path){
    case '/':
      try {
          fs.readFile(__dirname + PUBLIC_DIR + "/index.html", function(err, data){
            res.writeHead(200, {"Content-Type": "text/html"});
            if (err) {
                res.write("awww snap! we lost our home page");
            } else {
                res.write(data, 'utf8');
            }
            res.end();
        });
        break;
      } catch(e) {
          send404(res);
      }
      break;
    default:
      if (/\.(js|html|css|png|jpg|gif)$/.test(path)){
        try {
          var ext = Utils.ext(path);
          var mime = Utils.extToMime[ext];
          var binary = (ext === '.jpg' || ext === '.png' || ext === '.gif' || ext === '.ico');

          res.writeHead(200, {'Content-Type' : mime});
          var fullpath = __dirname + PUBLIC_DIR + path;
          //console.log(fullpath);
          fs.readFile(fullpath, binary ? 'binary' : 'utf8', function(err, data){
            if (err) {
              res.write('awww snap! you sure this thing is around?');
            } else {
              res.write(data, binary ? 'binary' : 'utf8');
            }
            res.end();
          });
        } catch(e){
          console.log("Exception: "+e);
          send404(res);
        }
        break;
      }

      send404(res);
      break;
  }
});

server.listen(80);

var engine = new ServerEngine();
engine.start();

var io = socket.listen(server);

var clients = {}; // map of all clients to gameClient objects

// send user data down to the client.
setInterval(broadcastUserData, 1000);

function broadcastUserData() {
  var users = engine.users,
      outUsers = [];
  for (var i = users.length - 1; i >= 0; i--) {
    if (users[i].snake) {
      outUsers.push({props: users[i].props, snake: users[i].snake});
    }
  }
  io.broadcast(protocol.newMessage(protocol.Types.Users, outUsers));
}

io.on('connection', function(client){
  var gameClient = new protocol.GameClient(client);
  clients[client.sessionId] = gameClient;
  engine.registerClient(gameClient);

  //client.send({ buffer: buffer });
  //client.broadcast({ announcement: client.sessionId + ' connected' });

  client.on('message', function(message){
    var type = protocol.messageType(message);
    if (type === protocol.Types.GameState) {
      clients[client.sessionId].receive(protocol.messageData(message));
    }
    // else {
    //
    // }
  });

  client.on('disconnect', function(){
    engine.unregisterClient(clients[client.sessionId]);
  });
});