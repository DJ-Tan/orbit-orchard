// Usage: node tools/solve.js js/levels/w1.js [--level N] [--fine]
"use strict";
const path = require("path");
global.window = global;
const Sim = require(path.join(__dirname, "..", "..", "js", "sim.js"));

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && /\.js$/.test(a));
const onlyIdx = args.includes("--level") ? parseInt(args[args.indexOf("--level") + 1], 10) : null;
const fine = args.includes("--fine");
if (!file) { console.error("usage: node tools/solve.js <world-file.js> [--level N] [--fine]"); process.exit(2); }

global.ORCHARD_WORLDS = [];
require(path.resolve(file));
const worlds = global.ORCHARD_WORLDS;
if (!worlds.length) { console.error("No world registered. The file must push onto window.ORCHARD_WORLDS."); process.exit(2); }

const KINDS = ["fertile", "barren", "sun", "ice", "blackhole", "repulsor"];
let failed = 0;

function isMoving(lv) { return lv.bodies.some((b) => b.orbit || (b.shield && b.shield.w)); }
function outerR(b) { return b.shield ? Sim.shieldRadius(b) : b.r; }

function validate(world, lv, ids) {
  const errs = [], warns = [];
  const need = (k) => { if (lv[k] == null) errs.push(`missing ${k}`); };
  ["id", "name", "hint", "seeds", "par", "preview", "launch", "bodies"].forEach(need);
  if (errs.length) return { errs, warns };
  if (ids.has(lv.id)) errs.push(`duplicate id ${lv.id}`);
  ids.add(lv.id);
  if (!/^w\d-\d{2}$/.test(lv.id)) errs.push(`id must look like w1-01, got ${lv.id}`);
  lv.bodies.forEach((b, i) => {
    if (!KINDS.includes(b.kind)) errs.push(`body ${i} unknown kind ${b.kind}`);
    if (!(b.r > 0)) errs.push(`body ${i} bad radius`);
    if (!b.orbit && (b.x == null || b.y == null)) errs.push(`body ${i} needs x,y or orbit`);
    if (b.orbit && b.orbit.p != null && (b.orbit.p >= i)) errs.push(`body ${i} orbit.p must reference an earlier body`);
    if (b.shield && !(b.shield.gap > 0.2 && b.shield.gap < 6)) errs.push(`body ${i} shield.gap should be radians in (0.2, 6)`);
  });
  const fert = lv.bodies.filter((b) => b.kind === "fertile");
  if (!fert.length) errs.push("no fertile bodies");
  const needSum = fert.reduce((s, b) => s + (b.need || 1), 0);
  if (lv.par !== needSum) warns.push(`par ${lv.par} != total need ${needSum}`);
  if (lv.seeds < lv.par) errs.push(`seeds ${lv.seeds} < par ${lv.par}`);
  const [lx, ly] = lv.launch;
  if (lx < 40 || lx > 1560 || ly < 40 || ly > 960) errs.push("launch outside safe area");
  const Ts = [];
  for (let T = 0; T <= 60; T += 0.25) Ts.push(T);
  const moving = lv.bodies.some((b) => b.orbit);
  for (const T of moving ? Ts : [0]) {
    const P = Sim.positions(lv.bodies, T);
    for (let i = 0; i < lv.bodies.length; i++) {
      const b = lv.bodies[i], [x, y] = P[i], R = outerR(b);
      if (x - b.r < 20 || x + b.r > 1580 || y - b.r < 20 || y + b.r > 980) { errs.push(`body ${i} leaves the world at T=${T}`); return { errs, warns }; }
      if (Math.hypot(x - lx, y - ly) < R + 40) { errs.push(`body ${i} too close to launch at T=${T}`); return { errs, warns }; }
      for (let j = i + 1; j < lv.bodies.length; j++) {
        const c = lv.bodies[j];
        if (Math.hypot(x - P[j][0], y - P[j][1]) < R + outerR(c) + 12) { errs.push(`bodies ${i} and ${j} overlap at T=${T}`); return { errs, warns }; }
      }
    }
  }
  const P0 = Sim.positions(lv.bodies, 0);
  const pts = [];
  (lv.portals || []).forEach((p, k) => { pts.push([`portal ${k}a`, p.a, Sim.PORTAL_R]); pts.push([`portal ${k}b`, p.b, Sim.PORTAL_R]); });
  (lv.boosts || []).forEach((g, k) => pts.push([`boost ${k}`, [g.x, g.y], Sim.BOOST_R]));
  (lv.pollen || []).forEach((q, k) => pts.push([`pollen ${k}`, q, Sim.POLLEN_R]));
  for (const [name, p, r] of pts) {
    if (p[0] < 30 || p[0] > 1570 || p[1] < 30 || p[1] > 970) errs.push(`${name} outside world`);
    lv.bodies.forEach((b, i) => { if (!b.orbit && Math.hypot(p[0] - P0[i][0], p[1] - P0[i][1]) < outerR(b) + r + 4) errs.push(`${name} overlaps body ${i}`); });
  }
  return { errs, warns };
}

function solve(lv) {
  const angStep = fine ? 1 : 1.5, powStep = fine ? 0.025 : 0.035;
  const T0s = isMoving(lv) ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [0];
  const fert = lv.bodies.map((b, i) => (b.kind === "fertile" ? i : -1)).filter((i) => i >= 0);
  const hits = {}, via = {};
  fert.forEach((i) => { hits[i] = 0; via[i] = { warp: 0, bounce: 0, boost: 0 }; });
  const pollen = (lv.pollen || []).map(() => 0);
  let total = 0;
  for (const T0 of T0s) {
    for (let a = 0; a < 360; a += angStep) {
      for (let p = 0.1; p <= 1.0001; p += powStep) {
        total++;
        const got = (lv.pollen || []).map(() => false);
        const r = Sim.simulateShot(lv, (a * Math.PI) / 180, p, T0, Sim.FLIGHT_MAX, got);
        got.forEach((g, k) => { if (g) pollen[k]++; });
        if (r.end && r.end.type === "plant") {
          hits[r.end.i]++;
          for (const e of r.events) if (via[r.end.i][e.type] != null) via[r.end.i][e.type]++;
        }
      }
    }
  }
  return { hits, via, total, pollen, fert };
}

for (const world of worlds) {
  console.log(`\n=== World ${world.id}: ${world.name} (${world.levels.length} levels) ===`);
  const ids = new Set();
  world.levels.forEach((lv, idx) => {
    if (onlyIdx != null && idx !== onlyIdx) return;
    const { errs, warns } = validate(world, lv, ids);
    if (errs.length) { failed++; console.log(`[FAIL] #${idx} ${lv.id} ${lv.name}: ${errs.join("; ")}`); return; }
    if (process.env.VONLY) { console.log(`[val ] #${idx} ${lv.id} ok`); return; }
    const res = solve(lv);
    const pct = res.fert.map((i) => (100 * res.hits[i]) / res.total);
    const unreachable = res.fert.filter((i) => res.hits[i] === 0);
    const deadPollen = res.pollen.map((c, k) => (c === 0 ? k : -1)).filter((k) => k >= 0);
    const diff = pct.length ? Math.min(...pct) : 0;
    const tag = unreachable.length ? "FAIL" : "ok  ";
    if (unreachable.length) failed++;
    const detail = res.fert.map((i) => {
      const v = res.via[i], m = [v.warp && `warp${v.warp}`, v.bounce && `bounce${v.bounce}`, v.boost && `boost${v.boost}`].filter(Boolean).join(",");
      return `#${i}:${res.hits[i]}${m ? `(${m})` : ""}`;
    }).join(" ");
    console.log(`[${tag}] #${idx} ${lv.id} ${lv.name.padEnd(22)} hardest=${diff.toFixed(2)}%  ${detail}` +
      (deadPollen.length ? `  UNREACHABLE pollen ${deadPollen.join(",")}` : "") +
      (warns.length ? `  warn: ${warns.join("; ")}` : ""));
  });
}
console.log(failed ? `\n${failed} level(s) FAILED` : "\nAll levels valid and solvable.");
process.exit(failed ? 1 : 0);
