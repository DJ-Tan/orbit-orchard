"use strict";
const path = require("path");
module.exports = function () {
  global.window = global;
  global.ORCHARD_WORLDS = [];
  const f = path.resolve(__dirname, "../../js/levels/w2.js");
  delete require.cache[f];
  require(f);
  return global.ORCHARD_WORLDS[0];
};
