function extend(hashA, hashB) {
  for (var key in hashB)
    hashA[key] = hashB[key];
  return hashA;
}

/*
 * The board renders the state of the game, including all HTML effects.
 */
function RenderedBoard(width, height, boardElement) {
  this.divsize = 20;
  this.boardElement = $(boardElement);
  this.divs = this.createDivs(width, height, this.boardElement);
  this.TYPE_TO_CLASS = ["empty", "apple", "snake"];
}

extend(RenderedBoard.prototype, {
  set: function(x, y, cell) {
    this.drawCell(x, y, this.TYPE_TO_CLASS[cell.type]);
  },

  drawCell: function(x, y, className) {
    this.divs[x][y][0].className = className;
  },

  /* Creates and returns a widthxheight matrix of divs representing the game's surface. */
  createDivs: function(width, height, boardElement) {
    var divs = [];
    for (var x = 0; x < width; x++) {
      divs[x] = [];
      for (var y = 0; y < height; y++) {
        var div = $(document.createElement("div"));
        div.addClass("cell");
        div.css("left", this.divsize * x);
        div.css("top", this.divsize * y);
        boardElement.append(div);
        divs[x][y] = div;
      }
    }
    return divs;
  }
});