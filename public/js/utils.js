var utils = {};

utils.extend = function(hashA, hashB) {
  for (var key in hashB)
    hashA[key] = hashB[key];
  return hashA;
}

Function.prototype.bind = function(self) {
  var fn = this;
  return function() { fn.apply(self, arguments); };
}

exports.utils = utils;