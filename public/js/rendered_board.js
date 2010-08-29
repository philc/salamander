/*
 * The board renders the state of the game, including all HTML effects.
 */
function RenderedBoard(width, height, cellSize, boardElement) {
  this.cellSize = cellSize;
  this.boardElement = $(boardElement);
  this.divs = this.createDivs(width, height, this.boardElement);
  this.TYPE_TO_CLASS = ["empty", "food", "snake", "cactus"];
  // Cells used to render the tongue graphic for a given snake.
  this.snakeTongueCells = [];
}

extend(RenderedBoard.prototype, {
  set: function(x, y, cell) {
    var classes = [this.TYPE_TO_CLASS[cell.type], cell.snakeId ? "snake1" : null];// TODO HACK! cell.snakeId];
    if (cell.direction)
      classes.push(cell.direction);
    if (cell.segment)
      classes.push(cell.segment);
    this.drawCell(x, y, classes);
  },

  drawCell: function(x, y, classNames) {
    this.divs[x][y][0].className = classNames.join(" ");
  },

  /*
   * This takes a list of snakes and shows a tongue animation on ecah snake every once in awhile.
   */
  renderSnakeTongues: function(snakes) {
    // Make sure any existing tongue graphics are hidden, because the head it was attached to has since moved.
    for (var i = 0; i < this.snakeTongueCells.length; i++)
      this.snakeTongueCells[i].css("opacity", 0);

    for (var i = 0; i < snakes.length; i++) {
      var snake = snakes[i];
      var tongueCell = this.snakeTongueCells[i];
      if (!tongueCell)
        tongueCell = this.snakeTongueCells[i] = this.createTongueCell();

      // Animate the snake tongues every few turns randomly.
      var shouldAnimate = Math.floor(snakes.length * 10 * Math.random()) == 1;
      if (!shouldAnimate)
        continue;

      tongueCell.css("opacity", 1);
      var headDirection = snake.computeHeadDirection();
      var head = snake.head();
      var nextCell = [head[0] + headDirection[0],
                     head[1] + headDirection[1]];
      tongueCell.removeClass("up left down right");
      tongueCell.addClass(GridUtils.vectorToString(headDirection));
      tongueCell.css("left", this.cellSize * nextCell[0]);
      tongueCell.css("top", this.cellSize * nextCell[1]);
    }
  },

  createTongueCell: function() {
    var div = $(document.createElement("div"));
    div.addClass("tongue");
    this.boardElement.append(div);
    return div;
  },

  /*
   * To render the snake's death, clone all of its body divs and then animate them fading out.
   */
  renderDeath: function(snake) {
    var bodyCells = [];
    GridUtils.iterateAlongArticulations(snake.articulations, function(x, y) {
      bodyCells.push(this.divs[x][y].clone());
    }.bind(this));

    // Do not render the snake's head during death. The head's background image doesn't look good.
    bodyCells[0].removeClass("head").addClass("body");

    var animationProperties = {
      opacity: 0,
      width: 0,
      height: 0,
      // As the snake body shrinks, we want it to stay centered in the cell
      marginLeft: this.cellSize / 2,
      marginTop: this.cellSize / 2
    };

    jQuery.each(bodyCells, function(i, cell) {
      this.boardElement.append(cell);
      this.animateDeathFlash(cell);
    }.bind(this));

    setTimeout(function() {
      jQuery.each(bodyCells, function(i, element) {
        element.css("borderRadius", 3);
        element.animate(animationProperties,
            { easing: "linear", duration: 1200, complete: function() { $(this).remove(); }});
      });
    }, 100);
  },

  animateDeathFlash: function(element) {
    var flickerDuration = 80;
    new DelayedQueue(flickerDuration, [
      function() { element.addClass("flash1"); },
      function() { element.removeClass("flash1").addClass("flash2"); },
      function() { element.removeClass("flash2").addClass("flash1"); },
      function() { element.removeClass("flash1"); }
    ]);
  },

  /* Creates and returns a widthxheight matrix of divs representing the game's surface. */
  createDivs: function(width, height, boardElement) {
    var divs = [];
    for (var x = 0; x < width; x++) {
      divs[x] = [];
      for (var y = 0; y < height; y++) {
        var div = $(document.createElement("div"));
        div.css("left", this.cellSize * x);
        div.css("top", this.cellSize * y);
        boardElement.append(div);
        divs[x][y] = div;
      }
    }
    return divs;
  }
});

/*
 * A delayed queue dequeues one of its items every n seconds. It's used for animation.
 */
function DelayedQueue(dequeueDelay, functions) {
  this.delay = dequeueDelay;;
  this.functions = functions;
  this.popItem();
}
DelayedQueue.prototype = {
  popItem: function() {
    var fn = this.functions.shift();
    fn.call();
    if (this.functions.length > 0)
      setTimeout(this.popItem.bind(this), this.delay);
  }
}

