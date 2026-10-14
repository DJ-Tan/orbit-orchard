"use strict";
const path = require("path");
global.window = global;
const Sim = require(path.join(__dirname, "../../js/sim.js"));
const args = process.argv.slice(2);
const file = args[0], idx = parseInt(args[1], 10);
const draw = args.includes("--draw");
global.ORCHARD_WORLDS = [];
require(path.resolve(file));
const lv0 = global.ORCHARD_WORLDS[0].levels[idx];
function run(lv) {
  const fert = lv.bodies.map((b, i) => (b.kind === "fertile" ? i : -1)).filter((i) => i >= 0);
  const hits = {}; fert.forEach((i) => (hits[i] = []));
  const pol = (lv.pollen || []).map(() => 0);
  let total = 0;
  for (let a = 0; a < 360; a += 1.5) for (let p = 0.1; p <= 1.0001; p += 0.035) {
    total++;
    const got = (lv.pollen || []).map(() => false);
    const r = Sim.simulateShot(lv, a * Math.PI / 180, p, 0, Sim.FLIGHT_MAX, got);
    got.forEach((g, k) => { if (g) pol[k]++; });
    if (r.end && r.end.type === "plant") hits[r.end.i].push([a, +p.toFixed(3), r.events.filter(e => !Sim.TERMINAL[e.type]).map(e => e.type[0] + (e.k != null ? e.k : "")).join("")]);
  }
  return { fert, hits, total, pol };
}
function rep(tag, lv) {
  const r = run(lv);
  console.log(tag + " " + r.fert.map((i) => `#${i}:${(100 * r.hits[i].length / r.total).toFixed(2)}%`).join(" ") + (r.pol.length ? "  pollen " + r.pol.join(",") : ""));
  return r;
}
const base = rep("BASE   ", lv0);
for (const i of base.fert) {
  const h = base.hits[i];
  const pick = h.filter((_, j) => j % Math.max(1, Math.floor(h.length / 8)) === 0).slice(0, 8);
  console.log(`  #${i} eg: ` + pick.map((x) => `${x[0]}/${x[1]}${x[2] ? "[" + x[2] + "]" : ""}`).join(" "));
}
const strip = (k) => Object.assign({}, lv0, { [k]: undefined });
if (lv0.portals) rep("noPort ", strip("portals"));
if (lv0.winds) rep("noWind ", strip("winds"));
if (lv0.boosts) rep("noBoost", strip("boosts"));
if (lv0.boosts && lv0.boosts.some(g => g.ang != null)) rep("noAim  ", Object.assign({}, lv0, { boosts: lv0.boosts.map(g => Object.assign({}, g, { ang: undefined })) }));
if (draw) {
  const W = 100, H = 40, g = [];
  for (let y = 0; y < H; y++) g.push(Array(W).fill(" "));
  const put = (x, y, c) => { const cx = Math.floor(x / 16), cy = Math.floor(y / 25); if (cx >= 0 && cx < W && cy >= 0 && cy < H) g[cy][cx] = c; };
  (lv0.winds || []).forEach((w) => { for (let x = w.x; x < w.x + w.w; x += 16) for (let y = w.y; y < w.y + w.h; y += 25) put(x, y, "~"); });
  lv0.bodies.forEach((b) => { const ch = { fertile: "F", barren: "#", sun: "S", ice: "I" }[b.kind]; for (let x = b.x - b.r; x <= b.x + b.r; x += 8) for (let y = b.y - b.r; y <= b.y + b.r; y += 8) if (Math.hypot(x - b.x, y - b.y) <= b.r) put(x, y, ch);
    if (b.shield) for (let a = 0; a < 6.28; a += 0.05) if (!Sim.shieldOpen(b, a, 0)) put(b.x + Math.cos(a) * Sim.shieldRadius(b), b.y + Math.sin(a) * Sim.shieldRadius(b), "o"); });
  (lv0.portals || []).forEach((p, k) => { put(p.a[0], p.a[1], "P"); put(p.b[0], p.b[1], "P"); });
  (lv0.boosts || []).forEach((b) => put(b.x, b.y, "B"));
  (lv0.pollen || []).forEach((q) => put(q[0], q[1], "*"));
  const want = args[args.indexOf("--draw") + 1];
  let shot = null;
  if (want && want.indexOf("/") > 0) shot = want.split("/").map(Number);
  else for (const i of base.fert) if (base.hits[i].length) { const h = base.hits[i]; shot = h[Math.floor(h.length / 2)]; break; }
  if (shot) {
    const s = Sim.newSeed(lv0, shot[0] * Math.PI / 180, shot[1]); let T = 0;
    for (let n = 0; n < 1700; n++) { T += Sim.DT; const ev = Sim.stepSeed(lv0, s, T, Sim.DT, []); if (n % 3 === 0) put(s.x, s.y, "."); if (ev && Sim.TERMINAL[ev.type]) { console.log("end", ev.type, ev.i); break; } }
    console.log("shot", shot[0], shot[1]);
  }
  put(lv0.launch[0], lv0.launch[1], "L");
  console.log("+" + "-".repeat(W) + "+\n" + g.map((r) => "|" + r.join("") + "|").join("\n") + "\n+" + "-".repeat(W) + "+");
}
