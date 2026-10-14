"use strict";
const path = require("path");
global.window = global;
const Sim = require(path.join(__dirname, "..", "..", "js", "sim.js"));
global.ORCHARD_WORLDS = [];
const file = process.argv[2], idx = parseInt(process.argv[3], 10);
delete require.cache[path.resolve(file)];
require(path.resolve(file));
const lv = global.ORCHARD_WORLDS[0].levels[idx];
const moving = lv.bodies.some((b) => b.orbit || (b.shield && b.shield.w));
const T0s = moving ? [0, 2, 4, 6, 8, 10] : [0];
const fert = lv.bodies.map((b, i) => (b.kind === "fertile" ? i : -1)).filter((i) => i >= 0);
const hits = {}; fert.forEach((i) => (hits[i] = []));
const ends = {}; let total = 0;
for (const T0 of T0s) for (let a = 0; a < 360; a += 1.5) for (let p = 0.1; p <= 1.0001; p += 0.035) {
  total++;
  const r = Sim.simulateShot(lv, a * Math.PI / 180, p, T0, 14, null);
  const t = r.end ? r.end.type : "none"; ends[t] = (ends[t] || 0) + 1;
  if (t === "plant") hits[r.end.i].push([a, +p.toFixed(3), T0, r.events.map((e) => e.type[0]).join("")]);
}
const trajs = [];
function trace(a, p, T0, tag) {
  const s = Sim.newSeed(lv, a * Math.PI / 180, p), pts = [[s.x, s.y]];
  let T = T0;
  for (let i = 0; i < 14 * 120; i++) { T += Sim.DT; const ev = Sim.stepSeed(lv, s, T, Sim.DT, null); if (i % 3 === 0) pts.push([s.x, s.y]); if (ev && Sim.TERMINAL[ev.type]) { pts.push([s.x, s.y]); break; } }
  trajs.push({ tag, pts });
}
for (const i of fert) { const h = hits[i]; for (let k = 0; k < Math.min(6, h.length); k++) { const s = h[Math.floor(k * h.length / Math.min(6, h.length))]; trace(s[0], s[1], s[2], "hit" + i); } }
for (let a = 0; a < 360; a += 15) for (const p of [0.3, 0.6, 0.9]) trace(a, p, 0, "fan");
const out = { lv, P0: Sim.positions(lv.bodies, 0), trajs };
require("fs").writeFileSync(path.join(__dirname, "lv" + idx + ".json"), JSON.stringify(out));
console.log(lv.id, lv.name, "total", total, JSON.stringify(ends));
for (const i of fert) {
  const h = hits[i]; const via = {};
  h.forEach((x) => { via[x[3]] = (via[x[3]] || 0) + 1; });
  console.log(" #" + i, (100 * h.length / total).toFixed(2) + "%", JSON.stringify(via).slice(0, 200), "e.g.", JSON.stringify(h.slice(0, 3)));
}
