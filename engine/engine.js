
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

  // Cell is object with fields: type, snake_id, orientation(?)
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

  addSnake: function() {
    
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