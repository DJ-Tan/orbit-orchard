global.window = global;
window.OrchardSim = require("../../js/sim.js");
global.performance = { now: () => Date.now() };
require("../../js/game.js");
const levels = [];
let fb = 0;
for (let d = 1; d <= 5; d++) for (let s = 0; s < 8; s++) {
  const t0 = Date.now();
  const lv = Orchard.generateLevel("x" + s + "-" + d, { difficulty: d });
  const ms = Date.now() - t0;
  if (lv.bodies[0].x === 780 && lv.bodies.length === 2) { fb++; console.error("fallback", d, s, ms); }
  const o = Object.assign({}, lv, { id: "w9-" + String(levels.length + 1).padStart(2, "0") });
  delete o.seed; delete o.difficulty;
  levels.push(o);
}
require("fs").writeFileSync(__dirname + "/genworld.out.js", "window.ORCHARD_WORLDS = window.ORCHARD_WORLDS || []; window.ORCHARD_WORLDS.push(" + JSON.stringify({ id: 9, name: "Gen", blurb: "x", theme: {}, levels }) + ");\n");
console.error("fallbacks", fb);
