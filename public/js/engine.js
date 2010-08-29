
// Board cell types
EMPTY = 0;
APPLE = 1;
SNAKE = 2;
OBSTACLE = 3;

var COLORS = ["#abc","#cde","#123","#1e1","#59f", "#9b6", "#b38", "#a3c"];

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


function Snake(snakeId, articulations, size, desiredSize, requestedMoves, color) {
  this.init(snakeId, articulations, size, desiredSize, requestedMoves, color);
}
Snake.prototype = {
  init: function(snakeId, articulations, size, desiredSize, requestedMoves, color) {
    this.snakeId = snakeId;
    this.articulations = articulations;
    this.size = size;
    this.desiredSize = desiredSize;
    this.requestedMoves = requestedMoves;
    this.deathCallbacks = [];
    this.isBot = false;
    this.color = color;
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
    var increase = 4; // Math.floor(Math.min(1.5 * this.desiredSize, 10));
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
    this.isDead = true;
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
                        object.desiredSize, object.requestedMoves, object.color);
  return snake;
};
RANDOM_NAMES = [
    "Annie", "Bob", "Carly", "Damien","Jacob","Isabella","Ethan","Emma",
    "Michael","Olivia","Alexander","Sophia","William","Ava","Joshua","Emily","Daniel",
    "Madison","Jayden","Abigail","Noah","Chloe","Anthony","Mia"
  ];
Snake.randomName = function() {
  var index = Math.floor(Math.random() * RANDOM_NAMES.length);
  return RANDOM_NAMES[index];
}
Snake.randomColor = function() {
  var index = Math.floor(Math.random() * COLORS.length);
  return COLORS[index];
}


// Default values
BOARD_WIDTH = 100;
BOARD_HEIGHT = 60;
DESIRED_APPLES = 10;
OBSTACLE_COUNT = 5;
TURN_DURATION = 250;

function Engine(renderedBoard) { this.init(renderedBoard); }
Engine.prototype = {
  init: function(renderedBoard) {
    this.board = new Board(BOARD_WIDTH, BOARD_HEIGHT, renderedBoard);
    this.snakes = [];
    this.allApples = [];
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
      if (cell.type == SNAKE || cell.isTombstone || cell.type == OBSTACLE) {
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
          for (var j = 0; j < this.allApples.length; j++)
            if (this.allApples[j][0] == newHead[0] && this.allApples[j][1] == newHead[1])
              this.allApples.splice(j, 1);
        }
        this.board.set(oldHead[0], oldHead[1], { type: SNAKE, snakeId: snake.snakeId, segment: "body",
          color: snake.color});
        this.board.set(newHead[0], newHead[1], { type: SNAKE, snakeId: snake.snakeId, segment: "head",
            direction: GridUtils.vectorToString(headDirection), color: snake.color });
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
    this.dispatchEvent({ type: "turnProcessed" });
  },

  killSnakeAtIndex: function(index) {
    var snake = this.snakes[index];
    this.snakes.splice(index, 1);
    snake.die();//let it do any cleanup it wants
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

SNAKE_START_SIZE = 4;
MIN_DESIRED_SNAKES = 2;

// Bot constants
BOT_GO_STRAIGHT_PROBABILITY = 0.1; // TODO tweak

// TODO do nice inheritance
function ServerEngine() { this.subinit(); }
extend(ServerEngine.prototype, Engine.prototype);
extend(ServerEngine.prototype, {
  subinit: function() {
    this.init(null);
    this.isServer = true;
    this.users = [];
    this.allApples = [];
    this.newApples = [];
    this.addRandomApples(DESIRED_APPLES);
    this.addRandomObstacles();
    this.addBots(MIN_DESIRED_SNAKES);
  },

  registerClient: function(client) {
    var user = { "isHuman": true, "client": client, "snake": null, "props": null};
    this.users.push(user);
    // Register for moves from client
    client.receive = function(msg) {
      this.processMessage(msg, user);
    }.bind(this);
    this.sendSetupMessage(client);
  },

  unregisterClient: function(client) {
    for (var i = 0; i < this.users.length; i++) {
      if (this.users[i].client == client)
        this.users.splice(i, 1);
    }
  },

  processMessage: function(msg, user) {
    switch(msg.type) {
      case MessageType.START_GAME:
        // Create a snake for the user and let them know
        user.snake = this.createSnake();
        user.snake.addDeathCallback(function(snake){
          user.snake = null;
          user.client.send({ type: MessageType.SNAKE_DEAD });
        }.bind(this));
        break;
      case MessageType.REQUEST_MOVE:
        if (user.snake != null)
          user.snake.requestMove(msg.direction);
        break;
      case MessageType.SET_USER_PROPS:
        user.props = msg.props;
        break;
      default:
        console.log(msg.type);
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
        this.allApples.push([x, y]);
        this.newApples.push([x, y]);
        numApples -= 1;
      }
    }
  },

  /*
   * Adds obstacles to the board in random locations, but evenly distributes them.
   */
  addRandomObstacles: function() {
    // Divide the board up into vertical zones and distribute the obstacles evenly across them.
    // NOTE(philc): This is not as a good as true random placement, but we're in a rush.
    var zoneWidth = Math.floor(BOARD_WIDTH / OBSTACLE_COUNT);
    for (var i = 0; i < OBSTACLE_COUNT; i++) {
      this.addObstacleAt(
          randomNumber(i * zoneWidth, (i + 1) * zoneWidth - 2),
          randomNumber(2, BOARD_HEIGHT - 5));
    }
  },

  addObstacleAt: function(x, y) {
    console.log("Adding obstacle at", x, y);
    // An obstacle takes up many cells (2x3 at the moment) but the upper left corner should be marked
    // specifically, so it gets drawn/styled only once.
    for (var i = y; i < (y + 3) ; i++) {
      this.board.set(x, i, { type: OBSTACLE });
      this.board.set(x + 1, i, { type: OBSTACLE });
    }
    this.board.set(x, y, { type: OBSTACLE, segment: "obstacleCorner" });
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
      tail[axis] = head[axis] - (dist == 0 ? 1 : (dist / Math.abs(dist))) * (SNAKE_START_SIZE - 1);
      GridUtils.iterateAlongLine(head, tail, function(x, y) {
        if (GridUtils.outOfBounds([x, y], BOARD_WIDTH, BOARD_HEIGHT) ||
            this.board.get(x, y).type != EMPTY)
          head = null;
      }.bind(this));
    }

    var snake = new Snake(snakeId, [head, tail], SNAKE_START_SIZE, SNAKE_START_SIZE, [], 
      Snake.randomColor());
    this.snakes.push(snake);
    this.addSnakeToBoard(snake);
    this.snakeChanges[snakeId] = { type: SNAKE_ADDITION, snake: snake.serialize() };    
    return snake;
  },

  addBots: function(numBots) {
    for (var i = 0; i < numBots; i++) {
      console.log("adding bot");
      var snake = this.createSnake();
      snake.isBot = true;
      var user = { "isHuman": false, "client": null, "snake": snake,
                   "props": { "name": Snake.randomName() }};
      this.users.push(user);
    }
  },

  pruneBotUsers: function() {
    var deadBotFound = true;
    while (deadBotFound) {
      deadBotFound = false;
      for (var i = 0; i < this.users.length; i++) {
        if (!this.users[i].isHuman && (!this.users[i].snake || this.users[i].snake.isDead)) {
          this.users.splice(i, 1);
          deadBotFound = true;
          break;
        }
      }
    }
  },

  start: function() {
    console.log("start");
    this.turnTimer = setInterval(function() {
      try {
        this.preProcessTurn();
      } catch(e) {
        console.log("Swallowing Exception in preProcessTurn:", JSON.stringify(e));
      }
      try {
        this.processTurn();
        this.postProcessTurn();
      } catch(e) {
        console.log("Swallowing Exception in processTurn:", JSON.stringify(e));
      }
    }.bind(this), TURN_DURATION);
  },

  preProcessTurn: function() {
    this.addBots(Math.max(MIN_DESIRED_SNAKES - this.snakes.length, 0));
    // Compute bot moves
    for (var i = 0; i < this.snakes.length; i++) {
      var snake = this.snakes[i];
      if (snake.isBot) {
        // Find the closest apple
        if (Math.random() < BOT_GO_STRAIGHT_PROBABILITY)
          continue;
        if (this.allApples.length == 0)
          continue;
        var head = snake.head();
        var closestApple = this.allApples[0];
        var closestDistance = GridUtils.computeSquareDistance(head, closestApple);
        for (var j = 1; j < this.allApples.length; j++) {
          var distance = GridUtils.computeSquareDistance(head, this.allApples[j]);
          if (distance <= closestDistance) {
            closestApple = this.allApples[j];
            closestDistance = distance;
          }
        }
        // Go for the closestApple
        var currentDirection = snake.computeHeadDirection();
        var optimalDirectionPairs = GridUtils.computeOptimalDirections(head, closestApple, currentDirection);
        var bestDirection = null;
        for (var j = 0; j < optimalDirectionPairs.length; j++) {
          var nextPoint = optimalDirectionPairs[j].next;
          if (GridUtils.outOfBounds(nextPoint, BOARD_WIDTH, BOARD_HEIGHT))
            continue;
          var cell = this.board.get(nextPoint[0], nextPoint[1]);
          if (cell.type == SNAKE || cell.type == OBSTACLE)
            continue;
          bestDirection = optimalDirectionPairs[j].dir;
          break;
        }
        // Only request a move if changing direction
        if (bestDirection != null && bestDirection[0] != currentDirection[0])
          snake.requestMove(bestDirection);
      }
    }
  },

  postProcessTurn: function() {
    this.pruneBotUsers();
    this.addRandomApples(DESIRED_APPLES - this.allApples.length);
    this.broadcastUpdate();
  },

  broadcastUpdate: function() {
    var update = { type: MessageType.UPDATE,
               newApples: this.newApples,
               processedMoves: this.processedMoves,
               snakeChanges: this.snakeChanges };
    for (var i = 0; i < this.users.length; i++) {
      var user = this.users[i];
      if (!user.isHuman)
        continue;
      // Make user specific customizations: 
      if (user.snake && update.snakeChanges[user.snake.snakeId])
        update.snakeChanges[user.snake.snakeId].isMySnake = true;
      user.client.send(update);
      // Roll back user specific customizations: 
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
        // this.start();
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
            if (msg.snakeChanges[snakeId].isMySnake) {
              this.mySnake = snake;
              console.log(snake);
            }
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
      this.allApples.push([point[0], point[1]]);
    }
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

  // TODO use this in processTurn
  addVectorToPoint: function(point, vector) {
    return [point[0] + vector[0], point[1] + vector[1]];
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

  computeSquareDistance: function(point1, point2) {
    var deltaX = point1[0] - point2[0];
    var deltaY = point1[1] - point2[1];
    return deltaX * deltaX + deltaY * deltaY;
  },

  // Returns a list of { "dir": [dx,dy], "next": [x,y], "dist": distance } objects sorted in ascending order by dist.
  computeOptimalDirections: function(origin, destination, currentDirection) {
    var possibleDirections = [
        currentDirection,
        [currentDirection[0] == 0 ? 1 : 0, currentDirection[1] == 0 ? 1 : 0],
        [currentDirection[0] == 0 ? -1 : 0, currentDirection[1] == 0 ? -1 : 0]
      ];
    var possiblePairs = new Array(3);
    for (var i = 0; i < possibleDirections.length; i++) {
      var nextPoint = GridUtils.addVectorToPoint(origin, possibleDirections[i]);
      possiblePairs[i] = {
        "dir": possibleDirections[i],
        "next": nextPoint,
        "dist": GridUtils.computeSquareDistance(nextPoint, destination)
      };
    }
    possiblePairs.sort(function(a, b) { return a.dist - b.dist; });
    return possiblePairs;
  },
};

exports.ServerEngine = ServerEngine;
