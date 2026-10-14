"use strict";
const path = require("path");
global.window = global;
const Sim = require("../../js/sim.js");
const args = process.argv.slice(2);
const idx = parseInt(args[0], 10);
const showMap = args.includes("--map");
const nSamples = args.includes("--samples") ? parseInt(args[args.indexOf("--samples") + 1], 10) : 0;
global.ORCHARD_WORLDS = [];
delete require.cache[path.resolve(__dirname, "../../js/levels/w2.js")];
require("../../js/levels/w2.js");
const lv = global.ORCHARD_WORLDS[0].levels[idx];
const fert = lv.bodies.map((b, i) => (b.kind === "fertile" ? i : -1)).filter((i) => i >= 0);
const stat = {}; fert.forEach((i) => stat[i] = { hits: 0, b0: 0, b1: 0, b2: 0, b3: 0, sols: [] });
const pol = (lv.pollen || []).map(() => 0);
const polSols = (lv.pollen || []).map(() => []);
let total = 0;
const ends = {};
for (let a = 0; a < 360; a += 1.5) for (let p = 0.1; p <= 1.0001; p += 0.035) {
  total++;
  const got = (lv.pollen || []).map(() => false);
  const r = Sim.simulateShot(lv, a * Math.PI / 180, p, 0, Sim.FLIGHT_MAX, got);
  got.forEach((g, k) => { if (g) { pol[k]++; polSols[k].push([a, +p.toFixed(3)]); } });
  const t = r.end ? r.end.type + (r.end.i != null ? r.end.i : "") : "none";
  ends[t] = (ends[t] || 0) + 1;
  if (r.end && r.end.type === "plant") {
    const s = stat[r.end.i]; s.hits++;
    const nb = r.events.filter((e) => e.type === "bounce").length;
    s["b" + Math.min(nb, 3)]++;
    s.sols.push([a, +p.toFixed(3), nb]);
  }
}
console.log(lv.id, lv.name, "total", total);
fert.forEach((i) => {
  const s = stat[i];
  console.log(`  #${i} ${(100 * s.hits / total).toFixed(2)}%  hits=${s.hits} b0=${s.b0} b1=${s.b1} b2=${s.b2} b3+=${s.b3}`);
  if (nSamples) {
    const step = Math.max(1, Math.floor(s.sols.length / nSamples));
    console.log("    ", s.sols.filter((_, k) => k % step === 0).slice(0, nSamples).map((x) => x.join("/")).join(" "));
  }
});
pol.forEach((c, k) => console.log(`  pollen ${k}: ${c}` + (nSamples ? "  " + polSols[k].slice(0, nSamples).map((x) => x.join("/")).join(" ") : "")));
console.log("  ends:", JSON.stringify(ends));
if (showMap) {
  const W = 100, H = 40, g = [];
  for (let y = 0; y < H; y++) g.push(new Array(W).fill("."));
  const put = (x, y, c) => { const gx = Math.floor(x / 16), gy = Math.floor(y / 25); if (gx >= 0 && gx < W && gy >= 0 && gy < H) g[gy][gx] = c; };
  const traj = args.includes("--traj") ? args[args.indexOf("--traj") + 1].split(",").map(Number) : null;
  if (traj) {
    const s = Sim.newSeed(lv, traj[0] * Math.PI / 180, traj[1]);
    let T = 0;
    for (let k = 0; k < 1700; k++) { T += Sim.DT; const ev = Sim.stepSeed(lv, s, T, Sim.DT, null); if (k % 3 === 0) put(s.x, s.y, "*"); if (ev) { put(s.x, s.y, "X"); console.log("  ev", ev.type, ev.i, Math.round(s.x), Math.round(s.y)); if (Sim.TERMINAL[ev.type]) break; } }
  }
  lv.bodies.forEach((b, i) => {
    const ch = { fertile: "F", barren: "#", sun: "S", ice: "o" }[b.kind];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cx = x * 16 + 8, cy = y * 25 + 12, d = Math.hypot(cx - b.x, cy - b.y);
      if (d < b.r) g[y][x] = ch === "F" ? String(i % 10) : ch;
      else if (b.shield && Math.abs(d - Sim.shieldRadius(b)) < 10 && !Sim.shieldOpen(b, Math.atan2(cy - b.y, cx - b.x), 0)) g[y][x] = "=";
    }
  });
  (lv.pollen || []).forEach((q) => put(q[0], q[1], "P"));
  put(lv.launch[0], lv.launch[1], "L");
  console.log(g.map((r) => r.join("")).join("\n"));
}
