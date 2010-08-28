function extend(hashA, hashB) {
  for (var key in hashB)
    hashA[key] = hashB[key];
  return hashA;
}

/*
 * The board renders the state of the game, including all HTML effects.
 */
function Board(boardElement) {
  this.divsize = 20;
  this.boardElement = $(boardElement);
  this.divs = this.createDivs(20, 20, this.boardElement);
}

extend(Board.prototype, {
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