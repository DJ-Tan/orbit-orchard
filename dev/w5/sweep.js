"use strict";
// usage: node sweep.js idx 'mutation-js-expression-using-lv'
global.window = global; global.ORCHARD_WORLDS = [];
require("../../js/levels/w5.js");
const q = require("./quickv.js");
const lv = JSON.parse(JSON.stringify(global.ORCHARD_WORLDS[0].levels[+process.argv[2]]));
eval(process.argv[3] || "");
console.log(process.argv[3], "=>", q(lv));
