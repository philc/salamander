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