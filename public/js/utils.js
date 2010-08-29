extend = function(hashA, hashB) {
  for (var key in hashB)
    hashA[key] = hashB[key];
  return hashA;
}

Function.prototype.bind = function(self) {
  var fn = this;
  return function() { fn.apply(self, arguments); };
}

randomNumber = function(min, max) {
  return min + Math.floor(Math.random() * (max - min));
};

/*
 * Mimicks the DOM event listener API, enabling it for plain javascript classes.
 */
EventDispatcher = {
  _getListeners: function(eventName) {
    if (!this.listeners)
      this.listeners = {};
    return (this.listeners[eventName] = (this.listeners[eventName] || []));
  },

  addEventListener: function(eventName, callback) {
    var callbacks = this._getListeners(eventName);
    if (callbacks.indexOf(callbacks) == -1)
      callbacks.push(callback);
  },

  removeEventListener: function(eventName, callback) {
    this._getListeners(eventName).remove(callback);
  },

  dispatchEvent: function(event) {
    var callbacks = this._getListeners(event.type);
    for (var i = 0; i < callbacks.length; i++)
      callbacks[i].call(null, event);
  }
}

/*
 * Display helpers
 */
centerWithinParent = function(element) {
  element.css("top", (element.parent().outerHeight() - element.outerHeight()) / 2);
  element.css("left", (element.parent().outerWidth() - element.outerWidth()) / 2);
}
