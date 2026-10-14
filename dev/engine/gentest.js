global.window = global;
window.OrchardSim = require("../../js/sim.js");
global.performance = { now: () => Number(process.hrtime.bigint ? process.hrtime.bigint() / 1000000n : Date.now()) };
require("../../js/game.js");
const Sim = window.OrchardSim;
let worst = 0, tot = 0, fails = 0;
for (let d = 1; d <= 5; d++) {
  for (let s = 0; s < 12; s++) {
    const t0 = Date.now();
    const lv = Orchard.generateLevel("seed" + s, { difficulty: d });
    const dt = Date.now() - t0; worst = Math.max(worst, dt); tot += dt;
    if (lv.id === undefined || lv.bodies.length === 2 && lv.bodies[0].x === 780) fails++;
    if (s === 0) console.log(d, dt + "ms", lv.name, lv.bodies.map(b => b.kind + (b.orbit ? "(o)" : "") + (b.shield ? "(s)" : "")).join(","), "P" + lv.portals.length, "W" + lv.winds.length, "B" + lv.boosts.length, "pol" + lv.pollen.length, "par", lv.par);
  }
}
console.log("worst", worst, "avg", (tot / 60).toFixed(0), "fallbacks", fails);
const a = JSON.stringify(Orchard.generateLevel(42, { difficulty: 3 })), b = JSON.stringify(Orchard.generateLevel(42, { difficulty: 3 }));
console.log("deterministic", a === b);
