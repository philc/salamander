
// Top-level utility functions
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
  }
};


function Snake() { this.init(); }
Snake.prototype = {
  init: function() {
    this.articulations = [];
    this.size = 1;
    this.desiredSize = this.size;
    this.requestedMove = null;
  },

  computeDirection: function() {
    
  }
};


// Default values
BOARD_WIDTH = 3;
BOARD_HEIGHT = 3;
DESIRED_APPLES = 3;

function Engine(renderedBoard) { this.init(renderedBoard); }
Engine.prototype = {
  init: function(renderedBoard) {
    this.board = new Board(BOARD_WIDTH, BOARD_HEIGHT, renderedBoard);
    this.snakes = [];
    this.totalApples = 0;

    // this.addApples(DESIRED_APPLES);
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

  addSnake: function(snakeId, headX, headY, tailX, tailY) {
    var snake = new Snake();
    if (headX != headY && tailX != tailY)
      throw "Trying to add diagonal snake";
    GridUtils.iterateAlongLine(headX, headY, tailX, tailY, function(x, y) {
      if (this.board.get(x, y).type != EMPTY)
        throw "Trying to add snake to occupied cell";
      this.board.set(x, y, {type: SNAKE, snakeId: snakeId});
      snake.size += 1;
    }.bind(this));
    snake.articulations = [[headX, headY], [tailX, tailY]];
    snake.desiredSize = snake.size;
    this.snakes.push(snake);
  },

  start: function() {
    // TODO start timer
  },

  processTurn: function() {
    for (var i = 0; i < this.snakes.length; i++) {
      // Move snake's head
      // Move snake's tail
    }
    this.board.addApples(DESIRED_APPLES - this.board.totalApples);
  }
};

var GridUtils = {
  iterateAlongLine: function(x1, y1, x2, y2, block) {
    if (x1 == x2)
      this.iterateBetween(y1, y2, function(y) {
        block(x1, y);
      });
    else if (y1 == y2)
      this.iterateBetween(x1, x2, function(x) {
        console.log("calling block");
        block(x, y1);
      });
    else
      throw "Trying to iterate along diagonal";
  },

  iterateBetween: function(i1, i2, block) {
    if (i1 < i2)
      for (var i = i1; i <= i2; i++)
        block(i);
    else
      for (var i = i1; i >= i2; i--)
        block(i);
  }
};