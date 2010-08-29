/*
 * The board renders the state of the game, including all HTML effects.
 */
function RenderedBoard(width, height, cellSize, boardElement) {
  this.cellSize = cellSize;
  this.boardElement = $(boardElement);
  this.divs = this.createDivs(width, height, this.boardElement);
  this.TYPE_TO_CLASS = ["empty", "apple", "snake", "snakeHead"];
}

extend(RenderedBoard.prototype, {
  set: function(x, y, cell) {
    var classes = [this.TYPE_TO_CLASS[cell.type], cell.snakeId];
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

    for (var i = 0; i < bodyCells.length; i++) {
      this.boardElement.append(bodyCells[i]);
      bodyCells[i].animate(animationProperties, { duration: 1500, complete: function() { $(this).remove(); }});
    }
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