global.window = global;
const Sim = require("../../js/sim.js");
global.ORCHARD_WORLDS = [];
require(require("path").resolve(process.argv[2]));
const lv = Object.assign({}, global.ORCHARD_WORLDS[0].levels[+process.argv[3]]);
(process.argv[4] || "winds").split(",").forEach(k => lv[k] = undefined);
const out = [];
for (let a = 0; a < 360; a += 1.5) for (let p = 0.1; p <= 1.0001; p += 0.035) { const r = Sim.simulateShot(lv, a * Math.PI / 180, p, 0, 14, null); if (r.end.type === "plant") out.push(a + "/" + p.toFixed(2)); }
console.log(out.join(" "));
