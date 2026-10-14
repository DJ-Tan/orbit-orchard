"use strict";
const path = require("path");
const Sim = require(path.join(__dirname, "..", "..", "js", "sim.js"));
module.exports = function quickv(lv, T0s) {
  const moving = lv.bodies.some((b) => b.orbit || (b.shield && b.shield.w));
  T0s = T0s || (moving ? [0, 3, 6, 9] : [0]);
  const fert = lv.bodies.map((b, i) => (b.kind === "fertile" ? i : -1)).filter((i) => i >= 0);
  const hits = {}, via = {}; fert.forEach((i) => { hits[i] = 0; via[i] = {}; }); let total = 0;
  for (const T0 of T0s) for (let a = 0; a < 360; a += 1.5) for (let p = 0.1; p <= 1.0001; p += 0.035) {
    total++;
    const r = Sim.simulateShot(lv, a * Math.PI / 180, p, T0, 14, null);
    if (r.end && r.end.type === "plant") { hits[r.end.i]++; const k = r.events.map((e) => e.type[0]).join(""); via[r.end.i][k] = (via[r.end.i][k] || 0) + 1; }
  }
  return fert.map((i) => i + ":" + (100 * hits[i] / total).toFixed(2) + JSON.stringify(via[i])).join(" ");
};
