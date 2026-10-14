"use strict";
global.window = global;
const Sim = require("../../js/sim.js");
const path = require("path");
const file = process.argv[2], idx = +process.argv[3], minB = +(process.argv[4] || 1);
global.ORCHARD_WORLDS = [];
require(path.resolve(file));
const lv = JSON.parse(JSON.stringify(global.ORCHARD_WORLDS[0].levels[idx]));
lv.pollen = [];
const G = 40, tot = {}, bnc = {};
for (let a = 0; a < 360; a += 1.5) for (let p = 0.1; p <= 1.0001; p += 0.035) {
  const s = Sim.newSeed(lv, a * Math.PI / 180, p);
  let T = 0, nb = 0; const seen = {};
  for (let k = 0; k < 1700; k++) {
    T += Sim.DT;
    const ev = Sim.stepSeed(lv, s, T, Sim.DT, null);
    const gx = Math.round(s.x / G), gy = Math.round(s.y / G);
    if (Math.hypot(s.x - gx * G, s.y - gy * G) < 18) {
      const key = gx + "," + gy;
      if (!seen[key]) { seen[key] = 1; tot[key] = (tot[key] || 0) + 1; if (nb >= minB) bnc[key] = (bnc[key] || 0) + 1; }
    }
    if (ev) { if (ev.type === "bounce") nb++; if (Sim.TERMINAL[ev.type]) break; }
  }
}
const rows = [];
for (const k in tot) {
  const [gx, gy] = k.split(",").map(Number), x = gx * G, y = gy * G;
  if (x < 40 || x > 1560 || y < 40 || y > 940) continue;
  if (lv.bodies.some((b) => Math.hypot(x - b.x, y - b.y) < (b.shield ? Sim.shieldRadius(b) : b.r) + 30)) continue;
  if (tot[k] < 6) continue;
  rows.push([x, y, tot[k], bnc[k] || 0, (bnc[k] || 0) / tot[k]]);
}
rows.sort((a, b) => b[4] - a[4] || b[3] - a[3]);
rows.slice(0, 30).forEach((r) => console.log(r[0], r[1], "touch", r[2], "bounced", r[3], r[4].toFixed(2)));
