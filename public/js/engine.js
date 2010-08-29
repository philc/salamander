
// Top-level utility functions
function extend(hashA, hashB) {
  for (var key in hashB)
    hashA[key] = hashB[key];
  return hashA;
}

Function.prototype.bind = function(self) {
  var fn = this;
  return function() { fn.apply(self, arguments); };
}

// Board cell types
EMPTY = 0;
APPLE = 1;
SNAKE = 2;

function Board(width, height, renderedBoard) { this.init(width, height, renderedBoard); }
Board.prototype = {
  init: function(width, height, renderedBoard) {
    this.renderedBoard = renderedBoard;
    this.matrix = new Array(width);
    for(var i = 0; i < width; i++) {
      this.matrix[i] = new Array(height);
      for(var j = 0; j < height; j++) {
        this.matrix[i][j] = {type: EMPTY};
      }
    }
  },

  // Cell is object with fields: type, snakeId, orientation(?)
  get: function(x, y) {
    return this.matrix[x][y];
  },

  set: function(x, y, cell) {
    this.matrix[x][y] = cell;
    if (this.renderedBoard) {
      this.renderedBoard.set(x, y, cell);
    }
  },

  setMatrix: function(matrix) {
    this.matrix = matrix;
    for(var i = 0; i < matrix.length; i++)
      for(var j = 0; j < matrix[0].length; j++)
        if (this.renderedBoard)
          this.renderedBoard.set(i, j, matrix[i][j]);
  },

  renderDeath: function(snake) {
    if (this.renderedBoard)
      this.renderedBoard.renderDeath(snake);
  },
};


function Snake(snakeId, articulations, size, desiredSize, requestedMoves) {
  this.init(snakeId, articulations, size, desiredSize, requestedMoves);
}

Snake.prototype = {
  init: function(snakeId, articulations, size, desiredSize, requestedMoves) {
    this.snakeId = snakeId;
    this.articulations = articulations;
    this.size = size;
    this.desiredSize = desiredSize;
    this.requestedMoves = requestedMoves;
    this.deathCallbacks = [];
  },

  head: function() { return this.articulations[0]; },

  // Returns direction as a pair of x,y deltas (e.g. [-1,0]).
  computeHeadDirection: function() {
    return GridUtils.computeDirection(this.articulations[0], this.articulations[1]);
  },

  computeTailDirection: function() {
    var len = this.articulations.length
    return GridUtils.computeDirection(this.articulations[len-2], this.articulations[len-1]);
  },

  eatApple: function() {
    var increase = Math.floor(Math.min(1.5 * this.desiredSize, 10));
    this.desiredSize += increase;
  },


  isMovePossible: function(direction) {
    var currentDirection = this.computeHeadDirection();
    // The new move must go from horizontal to vertical or vertical to horizontal.
    return (direction[0] * currentDirection[0] +
            direction[1] * currentDirection[1] == 0)
  },

  // Returns whether or not the move is possible
  requestMove: function(requestedDirection) {
    if (this.requestedMoves.length >= 2)
      this.requestedMoves.shift();
    this.requestedMoves.push(requestedDirection);
  },

  /*
   * Returns the snake's next requested move, or null if there is no valid requested move.
   */
  popNextMove: function() {
    // iterates through the moves that were requested and discards ones which are not relevant given
    // the current state of the snake.
    while (this.requestedMoves.length > 0) {
      var move = this.requestedMoves.shift();
      if (this.isMovePossible(move))
        return move;
    }
    return null;
  },

  addDeathCallback: function(fun) {
    this.deathCallbacks.push(fun);
  },
  
  die: function() {
    for (var i = this.deathCallbacks.length - 1; i >= 0; i--){
      this.deathCallbacks[i](this);
    };
  },

  serialize: function() {
    return JSON.stringify(this);
  }
}
Snake.deserialize = function(data) {
  var object = eval("(" + data + ")");
  var snake = new Snake(object.snakeId, object.articulations, object.size,
                        object.desiredSize, object.requestedMoves);
  return snake;
};


// Default values
BOARD_WIDTH = 40;
BOARD_HEIGHT = 40;
DESIRED_APPLES = 10;
TURN_DURATION = 250;

function Engine(renderedBoard) { this.init(renderedBoard); }
Engine.prototype = {
  init: function(renderedBoard) {
    this.board = new Board(BOARD_WIDTH, BOARD_HEIGHT, renderedBoard);
    this.snakes = [];
    this.totalApples = 0;
    this.processedMoves = {}; // Contains the snake moves processed in the last turn, snakeId => [dx,dy]
    this.snakeChanges = {}; // Mapping of snakeId => {type: add|remove}
  },

  addSnakeToBoard: function(snake) {
    console.log("addSnakeToBoard", snake);
    var head = snake.articulations[0];
    var tail = snake.articulations[1];
    if (head[0] != tail[0] && head[1] != tail[1])
      throw "Trying to add diagonal snake";
    GridUtils.iterateAlongLine(head, tail, function(x, y) {
      if (this.board.get(x, y).type != EMPTY)
        throw "Trying to add snake to occupied cell";
      this.board.set(x, y, {type: SNAKE, snakeId: snake.snakeId});
    }.bind(this));
  },

  start: function() {
    console.log("start");
    if (!this.isServer) // TODO HACK until we have proper syncing with the server.
      return;
    this.turnTimer = setInterval(function() {
      try {
        this.processTurn();
      } catch(e) {
        console.log("Swallowing Exception:", JSON.stringify(e));
      }
    }.bind(this), TURN_DURATION);
  },

  processTurn: function() {
    this.processedMoves = {};
    var tombstones = []; // List of "tombstones" marking the heads of snakes that died this turn.
    for (var i = 0; i < this.snakes.length; i++) {
      var snake = this.snakes[i];
      var requestedMove = snake.popNextMove();
      if (requestedMove)
        this.processedMoves[snake.snakeId] = requestedMove;
      // Move snake's head
      var headDirection = requestedMove || snake.computeHeadDirection();
      var oldHead = snake.head();
      var newHead = [snake.head()[0] + headDirection[0],
                     snake.head()[1] + headDirection[1]];
      if (GridUtils.outOfBounds(newHead, BOARD_WIDTH, BOARD_HEIGHT)) {
        this.killSnakeAtIndex(i);
        continue;
      }
      var cell = this.board.get(newHead[0], newHead[1]);
      if (cell.type == SNAKE || cell.isTombstone) {
        this.killSnakeAtIndex(i);
        if (cell.segment == "head")
          // Kill the other snake at this cell if necessary
          for (var j = 0; j < this.snakes.length; j++)
            if (this.snakes[j].snakeId == cell.snakeId) {
              if (j < i)
                this.killSnakeAtIndex(j);
              else {
                // Place a tombstone at the cell of oldHead
                // TODO Technically we should place tombstones all along the body of the dead snake
                this.board.get(oldHead[0], oldHead[1]).isTombstone = true;
                tombstones.push([oldHead[0], oldHead[1]]);
              }
            }
        continue;
      }
      else {
        if (cell.type == APPLE) {
          snake.eatApple();
          this.totalApples -= 1;
        }
        this.board.set(oldHead[0], oldHead[1], { type: SNAKE, snakeId: snake.snakeId, segment: "body" });
        this.board.set(newHead[0], newHead[1], { type: SNAKE, snakeId: snake.snakeId, segment: "head",
            direction: GridUtils.vectorToString(headDirection) });
        if (requestedMove) { // The snake has turned
          snake.articulations = [newHead].concat(snake.articulations);
        }
        else { // The snake is going straight
          snake.articulations[0] = newHead;
        }
      }

      // Move snake's tail
      if (snake.desiredSize > snake.size) {
        snake.size += 1;
      }
      else {
        var len = snake.articulations.length;
        var oldTail = snake.articulations[len-1];
        this.board.set(oldTail[0], oldTail[1], { type: EMPTY });
        var tailDirection = snake.computeTailDirection();
        var newTail = [oldTail[0] + tailDirection[0], oldTail[1] + tailDirection[1]];
        if (newTail[0] == snake.articulations[len-2][0] && newTail[1] == snake.articulations[len-2][1]) {
          // Remove the last articulation
          snake.articulations.splice(len-1, 1);
        }
        else {
          snake.articulations[len-1] = newTail;
        }
      }
    }

    // Clean out all tombstones
    for (var i = 0; i < tombstones.length; i++)
      delete this.board.get(tombstones[i][0], tombstones[i][1]).isTombstone;

    if (this.isServer) {
      this.addRandomApples(DESIRED_APPLES - this.totalApples);
      this.broadcastUpdate();
    } else {
      this.dispatchEvent({ type: "turnProcessed" });
    }
  },

  killSnakeAtIndex: function(index) {
    var snake = this.snakes[index];
    snake.die();//let it do any cleanup it wants
    this.snakes.splice(index, 1);
    this.board.renderDeath(snake);
    // Remove the snake's cells
    GridUtils.iterateAlongArticulations(snake.articulations, function(x, y) {
      this.board.set(x, y, { type: EMPTY });
    }.bind(this));
    this.snakeChanges[snake.snakeId] = { type: SNAKE_REMOVE };
    // Client-specific code
    if (this.mySnake && this.mySnake.snakeId === snake.snakeId)
      this.mySnake = null;
  },

  togglePause: function() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    } else {
      this.start();
    }
  }
};

extend(Engine.prototype, EventDispatcher);


var MessageType = {
  // Sent from server to client
  SETUP: "setup",
  UPDATE: "update",
  SNAKE_DEAD: "sankeDead",

  // Sent from client to server
  SET_USER_PROPS: "setUserProps",
  START_GAME: "startGame",
  REQUEST_MOVE: "requestMove",
};

SNAKE_ADDITION = "add";
SNAKE_REMOVE = "remove";

SNAKE_START_SIZE = 3;

// TODO do nice inheritance
function ServerEngine() { this.subinit(); }
extend(ServerEngine.prototype, Engine.prototype);
extend(ServerEngine.prototype, {
  subinit: function() {
    this.init(null);
    this.isServer = true;
    this.users = [];
    this.newApples = [];
    this.addRandomApples(DESIRED_APPLES);
  },

  registerClient: function(client) {
    var user = { "client": client, "snake": null, "props": null};
    this.users.push(user);
    // Register for moves from client
    client.receive = function(msg) {
      this.processMessage(msg, user);
    }.bind(this);
    this.sendSetupMessage(client);
  },

  unregisterClient: function(client) {
    // TODO
  },

  processMessage: function(msg, user) {
    console.log("processMessage", JSON.stringify(msg));
    switch(msg.type) {
      case MessageType.START_GAME:
        // Create a snake for the user and let them know
        user.snake = this.createSnake();
        user.snake.addDeathCallback(function(snake){
          user.snake = null;
          user.client.send({ type: MessageType.SNAKE_DEAD });
        });
        break;
      case MessageType.REQUEST_MOVE:
        if (user.snake != null)
          user.snake.requestMove(msg.direction);
        break;
      case MessageType.SET_USER_PROPS:
        user.props = msg.props;
        break;
      default:
        throw "Unrecognized message type " + msg.type;
    }
  },

  sendSetupMessage: function(client) {
    // Send down entire board and snake list to new user
    var snakeData = [];
    for (var i = 0; i < this.snakes.length; i++)
      snakeData.push(this.snakes[i].serialize());
    client.send({ type: MessageType.SETUP, board: this.board.matrix, snakes: snakeData });
  },

  addRandomApples: function(numApples) {
    while (numApples > 0) {
      var x = Math.floor(BOARD_WIDTH * Math.random());
      var y = Math.floor(BOARD_HEIGHT * Math.random());
      if (this.board.get(x, y).type == EMPTY) {
        this.board.set(x, y, {type: APPLE});
        this.totalApples += 1;
        this.newApples.push([x, y]);
        console.log("Added apple", this.newApples.length);
        numApples -= 1;
      }
    }
  },

  // Creates a new snake object, and adds it to the board and snakes list, and returns it.
  createSnake: function () {
    // Find unused ID
    var snakeId = null;
    while (snakeId == null) {
      snakeId = Math.floor(Math.random() * 1000);
      for (var i = 0; i < this.snakes.length; i++)
        if (this.snakes[i].snakeId === snakeId)
          snakeId = null;
    }

    // Find free squares
    var head = null;
    var tail = null;
    while (head == null || tail == null) {
      head = [Math.floor(Math.random() * BOARD_WIDTH), Math.floor(Math.random() * BOARD_HEIGHT)];
      tail = [head[0], head[1]];
      var axis = Math.floor(Math.random() * 2);
      var dist = ((axis == 0) ? BOARD_WIDTH : BOARD_HEIGHT) / 2 - head[axis]; // Signed distance to center line
      tail[axis] = head[axis] - (dist == 0 ? 1 : (dist / Math.abs(dist))) * SNAKE_START_SIZE;
      GridUtils.iterateAlongLine(head, tail, function(x, y) {
        if (GridUtils.outOfBounds([x, y], BOARD_WIDTH, BOARD_HEIGHT) ||
            this.board.get(x, y).type != EMPTY)
          head = null;
      }.bind(this));
    }

    var snake = new Snake(snakeId, [head, tail], SNAKE_START_SIZE, SNAKE_START_SIZE, []);
    this.snakes.push(snake);
    this.addSnakeToBoard(snake);
    this.snakeChanges[snakeId] = { type: SNAKE_ADDITION, snake: snake.serialize() };
    return snake;
  },

  broadcastUpdate: function() {
    var update = { type: MessageType.UPDATE,
               newApples: this.newApples,
               processedMoves: this.processedMoves,
               snakeChanges: this.snakeChanges };
    for (var i = 0; i < this.users.length; i++) {
      var user = this.users[i];
      if (user.snake && update.snakeChanges[user.snake.snakeId])
        update.snakeChanges[user.snake.snakeId].isMySnake = true;
      user.client.send(update);
      if (user.snake && update.snakeChanges[user.snake.snakeId])
        update.snakeChanges[user.snake.snakeId].isMySnake = false;
    }
    this.newApples = [];
    this.processedMoves = {};
    this.snakeChanges = {};
  },
});


function ClientEngine(renderedBoard) { this.subinit(renderedBoard); }
extend(ClientEngine.prototype, Engine.prototype);
extend(ClientEngine.prototype, {
  subinit: function(renderedBoard) {
    this.init(renderedBoard);
    this.isServer = false;
    this.mySnake = null;
    this.addEventListener("turnProcessed",
        function() { this.board.renderedBoard.renderSnakeTongues(this.snakes); }.bind(this));
  },

  registerClient: function(client) {
    this.client = client;
    client.receive = function(msg) { this.processMessage(msg); }.bind(this);
  },

  unregisterClient: function(client) {
    // TODO
  },

  processMessage: function(msg) {
    switch(msg.type) {
      case MessageType.SETUP:
        // Populate the board
        this.board.setMatrix(msg.board);
        // Read in the snakes
        this.snakes = [];
        for (var i = 0; i < msg.snakes.length; i++) {
          this.snakes.push(Snake.deserialize(msg.snakes[i]));
        }
        this.start();
        break;
      case MessageType.UPDATE:
        // TODO Check for conflicts
        this.addSpecificApples(msg.newApples);
        // Process snake additions
        for (var snakeId in msg.snakeChanges) {
          if (msg.snakeChanges[snakeId].type == SNAKE_ADDITION) {
            var snake = Snake.deserialize(msg.snakeChanges[snakeId].snake);
            this.snakes.push(snake);
            this.addSnakeToBoard(snake);
            if (msg.snakeChanges[snakeId].isMySnake)
              this.mySnake = snake;
          }
        }
        // Process moves and snake removals
        for (var i = 0; i < this.snakes.length; i++) {
          var snakeId = this.snakes[i].snakeId;
          if (msg.snakeChanges[snakeId] && msg.snakeChanges[snakeId].type == SNAKE_REMOVE)
            this.killSnakeAtIndex(i);
          if (msg.processedMoves[snakeId])
            this.snakes[i].requestMove(msg.processedMoves[snakeId]);
        }
        this.processTurn();
        break;
      case MessageType.SNAKE_DEAD:
        this.dispatchEvent({type:"snakeDead"});
        break;
      default:
        throw "Unrecognized message type " + msg.type;
    }
  },

  startGame: function() {
    console.log("Engine.startGame");
    if (this.mySnake != null)
      return;
    this.client.send({ type: MessageType.START_GAME });
  },

  moveSnake: function(requestedDirection) {
    if (this.mySnake == null)
      return;
    // TODO Put back in this if statement when we want to have client seeking
    // if (this.mySnake.requestMove(requestedDirection))
      this.client.send({ type: MessageType.REQUEST_MOVE, direction: requestedDirection });
  },

  addSpecificApples: function(newApples) {
    for (var i = 0; i < newApples.length; i++) {
      var point = newApples[i];
      this.board.set(point[0], point[1], {type: APPLE});
    }
    this.totalApples += newApples.length;
  },
  
  setUserProps: function(newProps) {
    this.client.send({ type: MessageType.SET_USER_PROPS, props: newProps });
  }
});


var GridUtils = {
  outOfBounds: function(point, width, height) {
    return point[0] < 0 || point[0] >= width ||
           point[1] < 0 || point[1] >= height;
  },

  computeDirection: function(endPoint, startPoint) {
    var dx = endPoint[0] - startPoint[0];
    var dy = endPoint[1] - startPoint[1];
    return [dx == 0 ? dx : dx / Math.abs(dx), dy == 0 ? dy : dy / Math.abs(dy)];
  },

  // Args: block is a function that takes an index
  iterateBetween: function(i1, i2, block) {
    if (i1 < i2)
      for (var i = i1; i <= i2; i++)
        block(i);
    else
      for (var i = i1; i >= i2; i--)
        block(i);
  },

  // Args: block is a function that takes two coordinates.
  iterateAlongLine: function(startPoint, endPoint, block) {
    if (startPoint[0] == endPoint[0])
      this.iterateBetween(startPoint[1], endPoint[1], function(y) {
        block(endPoint[0], y);
      });
    else if (startPoint[1] == endPoint[1])
      this.iterateBetween(startPoint[0], endPoint[0], function(x) {
        block(x, endPoint[1]);
      });
    else
      throw "Trying to iterate along diagonal";
  },

  // Iterates through all the points between/along articulations, an array of x-y pairs.
  // Block is a function that takes two coordinates.
  iterateAlongArticulations: function(articulations, block) {
    for (var i = 0; i < articulations.length - 1; i++) {
      var excludeFirstPoint = (i != 0);
      this.iterateAlongLine(articulations[i], articulations[i+1], function(x, y) {
        if (excludeFirstPoint)
          excludeFirstPoint = false;
        else
          block(x, y);
      });
    }
    // Process the final point
    var lastPoint = articulations[articulations.length - 1];
    block(lastPoint[0], lastPoint[1]);
  },

  /*
   * Takes a vector of the form [x, y] and converts it to a human-readable direction string. Returns one of
   * left, right, down, up, none.
  */
  vectorToString:function(vector) {
    if (vector[0] != 0)
      return vector[0] < 0 ? "left" : "right";
    else if (vector[1] != 0)
      return vector[1] < 0 ? "up" : "down";
    return "none";
  },

};

exports.ServerEngine = ServerEngine;
