// Usage: node tools/difficulty.js [--world N] [--level wN-NN[,wN-NN...]] [--file SOLUTIONS] [--jobs J] [--json OUT] [--base JSON] [--quiet]
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const cp = require("child_process");
global.window = global;
const ROOT = path.join(__dirname, "..");
const Sim = require(path.join(ROOT, "js", "sim.js"));
const V = require("./verify-solutions.js");
const Solver = require("./solutions.js");

const DEG = Math.PI / 180;
const NA = 720, NP = 48, DA = 0.5, P0 = 0.06, DP = 0.02;
const FA = 41, FP = 25, FDA = 0.1, FDP = 0.005;
const TMAX = 120;

const args = process.argv.slice(2);
const opt = function (name, def) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

function isMoving(lv) { return lv.bodies.some(function (b) { return b.orbit || (b.shield && b.shield.w); }); }

/** Fires every cell of the 0.5 deg x 0.02 lattice at step k and returns the planted body per cell (-1 = none). */
function scanGrid(ctx, k) {
  const g = new Int8Array(NA * NP);
  for (let a = 0; a < NA; a++) {
    for (let p = 0; p < NP; p++) g[a * NP + p] = ctx.fire((-180 + a * DA) * DEG, P0 + p * DP, k, Sim.FLIGHT_MAX).b;
  }
  return g;
}

/** Size of the largest 4-connected cluster of cells whose body passes ok (angle wraps). */
function largest(g, ok) {
  const seen = new Uint8Array(NA * NP), st = [];
  let best = 0;
  for (let i = 0; i < NA * NP; i++) {
    if (seen[i] || g[i] < 0 || !ok(g[i])) continue;
    let n = 0;
    st.push(i);
    seen[i] = 1;
    while (st.length) {
      const c = st.pop(), a = Math.floor(c / NP), p = c % NP;
      n++;
      const nb = [((a + 1) % NA) * NP + p, ((a + NA - 1) % NA) * NP + p, p + 1 < NP ? c + 1 : -1, p > 0 ? c - 1 : -1];
      for (let j = 0; j < 4; j++) {
        const q = nb[j];
        if (q < 0 || seen[q] || g[q] < 0 || !ok(g[q])) continue;
        seen[q] = 1;
        st.push(q);
      }
    }
    if (n > best) best = n;
  }
  return best;
}

/** Cells of the fine 0.1 deg x 0.005 window around a shot connected to it that still plant body b. */
function basin(ctx, a, p, k, b) {
  const seen = new Uint8Array(FA * FP), st = [[20, 12]];
  let n = 0;
  while (st.length) {
    const c = st.pop(), i = c[0], j = c[1];
    if (i < 0 || i >= FA || j < 0 || j >= FP || seen[i * FP + j]) continue;
    seen[i * FP + j] = 1;
    const pw = p + (j - 12) * FDP;
    if (pw < 0.05 || pw > 1) continue;
    if (ctx.fire(a + (i - 20) * FDA * DEG, pw, k, Sim.FLIGHT_MAX).b !== b) continue;
    n++;
    st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  return n;
}

/** Launch steps the same aim may come early and late while still planting body b. */
function tolerance(ctx, a, p, k, b) {
  let lo = 0, hi = 0;
  for (let d = 1; d <= TMAX && k - d >= 0; d++) { if (ctx.fire(a, p, k - d, Sim.FLIGHT_MAX).b !== b) break; lo = d; }
  for (let d = 1; d <= TMAX; d++) { if (ctx.fire(a, p, k + d, Sim.FLIGHT_MAX).b !== b) break; hi = d; }
  return [lo, hi];
}

/** Measures every shot of a level's stored solution. */
function analyze(lv, entry) {
  const ctx = new Solver.Ctx(Object.assign({}, lv, { pollen: undefined }));
  const moving = isMoving(lv);
  const need = lv.bodies.map(function (b) { return b.kind === "fertile" ? (b.need || 1) : 0; });
  const got = need.map(function () { return 0; });
  const out = { id: lv.id, name: lv.name, moving: moving, shots: [] };
  if (!entry || !entry.shots) { out.error = "no solution"; return out; }
  let staticGrid = null;
  entry.shots.forEach(function (sh) {
    const a = sh[0], p = sh[1], k = sh[2];
    const b = ctx.fire(a, p, k, Sim.FLIGHT_MAX).b;
    const g = moving ? scanGrid(ctx, k) : (staticGrid = staticGrid || scanGrid(ctx, 0));
    const open = function (x) { return got[x] < need[x]; };
    const s = {
      k: k, b: b,
      region: largest(g, open),
      target: largest(g, function (x) { return x === b; }),
      basin: b >= 0 ? basin(ctx, a, p, k, b) : 0,
    };
    if (moving && b >= 0) s.tol = tolerance(ctx, a, p, k, b);
    out.shots.push(s);
    if (b >= 0) got[b]++;
  });
  let hi = 0;
  out.shots.forEach(function (s, i) { if (s.region < out.shots[hi].region) hi = i; });
  out.hardShot = hi;
  out.hard = out.shots[hi].region;
  out.strict = Math.min.apply(null, out.shots.map(function (s) { return s.target; }));
  out.basin = Math.min.apply(null, out.shots.map(function (s) { return s.basin; }));
  if (moving) out.tol = Math.min.apply(null, out.shots.map(function (s) { return s.tol ? s.tol[0] + s.tol[1] + 1 : 0; }));
  return out;
}

function median(xs) { const s = xs.slice().sort(function (x, y) { return x - y; }); return s.length ? s[s.length >> 1] : NaN; }
function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
function lpad(s, n) { s = String(s); while (s.length < n) s = " " + s; return s; }

/** Ratio of a plot's region to the median of its in-world neighbours two plots either side. */
function vsNeighbours(rows, i) {
  const w = rows[i].id.slice(0, 2), nb = [];
  for (let d = -2; d <= 2; d++) { const r = rows[i + d]; if (d && r && r.id.slice(0, 2) === w && r.hard != null) nb.push(r.hard); }
  return nb.length ? rows[i].hard / median(nb) : 1;
}

/** Display position of each world file prefix ("w4" -> 3), from the worlds' `order`. */
function displayOrder() {
  const out = {};
  V.loadLevels().worlds.forEach(function (W) { out["w" + W.id] = W.order != null ? W.order : W.id; });
  return out;
}

function report(rows, base, quiet) {
  const prev = {}, pos = displayOrder();
  (base || []).forEach(function (r) { prev[r.id] = r; });
  if (!quiet) {
    console.log(pad("plot", 7) + pad("name", 18) + lpad("hard", 6) + lpad("shot", 5) + lpad("strict", 7) + lpad("nbrs", 6) + lpad("basin", 7) + lpad("tol", 5) + (base ? lpad("was", 7) : "") + "  per shot region/basin/tol");
    rows.forEach(function (r, i) {
      if (r.error) { console.log(pad(r.id, 7) + r.error); return; }
      const ratio = vsNeighbours(rows, i);
      const per = r.shots.map(function (s) { return s.region + "/" + s.basin + (s.tol ? "/" + (s.tol[0] + s.tol[1] + 1) : ""); }).join(" ");
      const was = prev[r.id] ? lpad(prev[r.id].hard, 7) : base ? lpad("-", 7) : "";
      console.log(pad(r.id, 7) + pad(r.name.slice(0, 17), 18) + lpad(r.hard, 6) + lpad(r.hardShot, 5) + lpad(r.strict, 7) + lpad(ratio.toFixed(2) + (ratio < 0.4 ? "!" : " "), 6) +
        lpad(r.basin, 7) + lpad(r.moving ? r.tol : "-", 5) + was + "  " + per);
    });
    console.log("");
  }
  const worlds = {};
  rows.forEach(function (r) { if (!r.error) (worlds[r.id.slice(0, 2)] = worlds[r.id.slice(0, 2)] || []).push(r); });
  console.log(pad("world", 7) + lpad("median", 8) + lpad("8-15", 7) + lpad("min", 6) + lpad("strict", 8) + lpad("basin min", 11) + lpad("basin med", 11) + lpad("tol min", 9) + (base ? lpad("was", 7) : ""));
  const all = [];
  Object.keys(worlds).sort(function (a, b) { return (pos[a] || 0) - (pos[b] || 0) || (a < b ? -1 : 1); }).forEach(function (w) {
    const R = worlds[w], mid = R.filter(function (r) { const n = +r.id.slice(3); return n >= 8 && n <= 15; });
    const shots = [];
    R.forEach(function (r) { r.shots.forEach(function (s) { shots.push(s); all.push(s); }); });
    const tols = R.filter(function (r) { return r.moving; }).map(function (r) { return r.tol; });
    const pb = (base || []).filter(function (r) { return r.id.slice(0, 2) === w; });
    console.log(pad(w + " W" + pos[w], 7) + lpad(median(R.map(function (r) { return r.hard; })), 8) + lpad(mid.length ? median(mid.map(function (r) { return r.hard; })) : "-", 7) +
      lpad(Math.min.apply(null, R.map(function (r) { return r.hard; })), 6) + lpad(median(R.map(function (r) { return r.strict; })), 8) +
      lpad(Math.min.apply(null, shots.map(function (s) { return s.basin; })), 11) + lpad(median(shots.map(function (s) { return s.basin; })), 11) +
      lpad(tols.length ? Math.min.apply(null, tols) : "-", 9) +
      (base ? lpad(pb.length ? median(pb.map(function (r) { return r.hard; })) : "-", 7) : ""));
  });
  if (all.length) {
    const tl = all.filter(function (s) { return s.tol; }).map(function (s) { return s.tol[0] + s.tol[1] + 1; });
    console.log("all shots: basin min " + Math.min.apply(null, all.map(function (s) { return s.basin; })) + ", median " + median(all.map(function (s) { return s.basin; })) +
      (tl.length ? "; timed shots " + tl.length + ", tolerance min " + Math.min.apply(null, tl) + ", median " + median(tl) + ", under 20: " + tl.filter(function (t) { return t < 20; }).length : ""));
  }
}

function child() {
  const L = V.loadLevels(), sols = V.loadSolutions(opt("--file", null));
  process.on("message", function (msg) {
    if (msg.id == null) { process.exit(0); return; }
    let res;
    try { res = analyze(L.levels.get(msg.id), sols[msg.id]); } catch (e) { res = { id: msg.id, error: String(e && e.stack || e) }; }
    process.send(res);
  });
}

function main() {
  const world = opt("--world", null), only = opt("--level", null), quiet = args.indexOf("--quiet") >= 0;
  const jobs = parseInt(opt("--jobs", String(Math.max(1, os.cpus().length - 2))), 10);
  const L = V.loadLevels(), ids = [];
  L.levels.forEach(function (lv, id) {
    if (world && id.indexOf("w" + world + "-") !== 0) return;
    if (only && only.split(",").indexOf(id) < 0) return;
    ids.push(id);
  });
  if (!ids.length) { console.error("no levels match"); process.exit(2); }
  const base = opt("--base", null) ? JSON.parse(fs.readFileSync(opt("--base"), "utf8")) : null;
  const queue = ids.slice().sort(function (a, b) { return (isMoving(L.levels.get(b)) ? 1 : 0) - (isMoving(L.levels.get(a)) ? 1 : 0); });
  const results = {};
  let running = 0;
  const n = Math.min(jobs, queue.length);
  for (let i = 0; i < n; i++) {
    const w = cp.fork(__filename, ["--child"].concat(args));
    running++;
    const feed = function () { const id = queue.shift(); w.send({ id: id == null ? null : id }); };
    w.on("message", function (res) { results[res.id] = res; feed(); });
    w.on("exit", function () {
      if (--running) return;
      const rows = ids.map(function (id) { return results[id] || { id: id, error: "worker died" }; });
      report(rows, base, quiet);
      if (opt("--json", null)) fs.writeFileSync(opt("--json"), JSON.stringify(rows));
    });
    feed();
  }
}

module.exports = { analyze: analyze, scanGrid: scanGrid, largest: largest, basin: basin, tolerance: tolerance };
if (args.indexOf("--child") >= 0) child();
else if (require.main === module) main();
