
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
  }
};


function Snake(snakeId, articulations, size, desiredSize, requestedMove) {
  this.init(snakeId, articulations, size, desiredSize, requestedMove);
}
Snake.prototype = {
  init: function(snakeId, articulations, size, desiredSize, requestedMove) {
    this.snakeId = snakeId;
    this.articulations = articulations;
    this.size = size;
    this.desiredSize = desiredSize;
    this.requestedMove = requestedMove;
  },

  head: function() { return this.articulations[0]; },

  // Returns direction as a pair of x,y deltas (e.g. [-1,0]).
  computeHeadDirection: function() {
    return GridUtils.computeDirection(this.articulations[0], this.articulations[1]);
  },

  computeTailDirection: function() {
    var l = this.articulations.length
    return GridUtils.computeDirection(this.articulations[l-2], this.articulations[l-1]);
  },

  eatApple: function() {
    this.desiredSize += 2;
  },

  requestMove: function(requestedDirection) {
    var currentDirection = this.computeHeadDirection();
    if (requestedDirection[0] * currentDirection[0] +
        requestedDirection[1] * currentDirection[1] == 0) {
      this.requestedMove = requestedDirection;
    }
  },

  serialize: function() {
    return {
      snakeId: this.snakeId,
      articulations: this.articulations,
      size: this.size,
      desiredSize: this.desiredSize,
      requestedMove: this.requestedMove
    };
  }
}
Snake.deserialize = function(data) {
  var snake = new Snake(data.snakeId, data.articulations, data.size,
                        data.desiredSize, data.requestedMove);
  return snake;
};


// Default values
BOARD_WIDTH = 40;
BOARD_HEIGHT = 40;
DESIRED_APPLES = 3;
TURN_DURATION = 250;

function Engine(renderedBoard) { this.init(renderedBoard); }
Engine.prototype = {
  init: function(renderedBoard) {
    this.board = new Board(BOARD_WIDTH, BOARD_HEIGHT, renderedBoard);
    this.snakes = [];
    this.totalApples = 0;

    this.addApples(DESIRED_APPLES);
  },

  addApples: function(numApples) {
    while (numApples > 0) {
      var x = Math.floor(BOARD_WIDTH * Math.random());
      var y = Math.floor(BOARD_HEIGHT * Math.random());
      if (this.board.get(x, y).type == EMPTY) {
        this.board.set(x, y, {type: APPLE});
        this.totalApples += 1;
        numApples -= 1;
      }
    }
  },

  // Args: head and tail are x,y pairs
  addSnake: function(snakeId, head, tail) {
    var snake = new Snake();
    if (head[0] != tail[0] && head[1] != tail[1])
      throw "Trying to add diagonal snake";
    GridUtils.iterateAlongLine(head, tail, function(x, y) {
      if (this.board.get(x, y).type != EMPTY)
        throw "Trying to add snake to occupied cell";
      this.board.set(x, y, {type: SNAKE, snakeId: snakeId});
      snake.size += 1;
    }.bind(this));
    snake.snakeId = snakeId;
    snake.articulations = [head, tail];
    snake.desiredSize = snake.size;
    this.snakes.push(snake);
  },

  start: function() {
    this.turnTimer = setInterval(function() {
      this.processTurn();
    }.bind(this), TURN_DURATION);
  },

  processTurn: function() {
    for (var i = 0; i < this.snakes.length; i++) {
      var snake = this.snakes[i];
      // Move snake's head
      var headDirection = snake.requestedMove || snake.computeHeadDirection();
      var oldHead = snake.head();
      var newHead = [snake.head()[0] + headDirection[0],
                     snake.head()[1] + headDirection[1]];
      if (GridUtils.outOfBounds(newHead, BOARD_WIDTH, BOARD_HEIGHT)) {
        this.killSnakeAtIndex(i);
        continue;
      }
      var cell = this.board.get(newHead[0], newHead[1]);
      if (cell.type == SNAKE) {
        this.killSnakeAtIndex(i);
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
        if (snake.requestedMove) { // The snake has turned
          snake.articulations = [newHead].concat(snake.articulations);
        }
        else { // The snake is going straight
          snake.articulations[0] = newHead;
        }
      }
      snake.requestedMove = null;

      // Move snake's tail
      if (snake.desiredSize > snake.size) {
        snake.size += 1;
      }
      else {
        var l = snake.articulations.length;
        var oldTail = snake.articulations[l-1];
        this.board.set(oldTail[0], oldTail[1], { type: EMPTY });
        var tailDirection = snake.computeTailDirection();
        var newTail = [oldTail[0] + tailDirection[0],
                       oldTail[1] + tailDirection[1]];
        if (newTail[0] == snake.articulations[l-2][0] && newTail[1] == snake.articulations[l-2][1]) {
          // Remove the last articulation
          snake.articulations.splice(l-1, 1);
        }
        else {
          snake.articulations[l-1] = newTail;
        }
      }
    }
    // TODO Only call this on server
    this.addApples(DESIRED_APPLES - this.totalApples);
  },

  killSnakeAtIndex: function(index) {
    var snake = this.snakes[index];
    this.snakes.splice(index, 1);
    // Remove the snake's cells
    GridUtils.iterateAlongArticulations(snake.articulations, function(x, y) {
      this.board.set(x, y, { type: EMPTY });
    }.bind(this));
  },

  moveSnake: function(snakeId, requestedDirection) {
    for (var i = 0; i < this.snakes.length; i++) {
      var snake = this.snakes[i];
      if (snake.snakeId == snakeId) {
        snake.requestMove(requestedDirection);
      }
    }
  },

  togglePause: function() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    } else {
      this.start();
    }
  },

};


var MessageType = {
  // Sent from server to client
  SETUP: 0,
  GAME_STARTED: 1,

  // Sent from client to server
  START_GAME: 10,
};

// TODO do nice inheritance
function ServerEngine() { this.subinit(); }
extend(ServerEngine.prototype, Engine.prototype);
extend(ServerEngine.prototype, {
  subinit: function() {
    this.init(null);
    this.users = [];
  },

  registerClient: function(client) {
    var user = { "client": client, "snake": null };
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

  sendSetupMessage: function(client) {
    // Send down entire board and snake list to new user
    var snakeData = [];
    for (var i = 0; i < this.snakes.length; i++)
      snakeData.push(this.snakes[i].serialize());
    client.send({ type: MessageType.SETUP, board: this.board.matrix, snakes: snakeData });
  },

  processMessage: function(msg, user) {
    switch(msg.type) {
      case MessageType.START_GAME:
        // Create a snake for the user and let them know
        user.snake = this.createSnake();
        user.client.send({ type: MessageType.GAME_STARTED, snake: user.snake.serialize() });
        break;
      default:
        throw "Unrecognized message type " + msg.type;
    }
  }
});


function ClientEngine(renderedBoard) { this.subinit(renderedBoard); }
extend(ClientEngine.prototype, Engine.prototype);
extend(ClientEngine.prototype, {
  subinit: function(renderedBoard) {
    this.init(renderedBoard);
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
        break;
      case MessageType.GAME_STARTED:
        this.snakes.push(Snake.deserialize(msg.snake));
        // TODO Let the user control this snake
        break;
      default:
        throw "Unrecognized message type " + msg.type;
    }
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
   * Takes a vector of the form [x, y] and converts that to a human-readable direction string. Returns one of
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

exports.Engine = Engine;
