// Usage: node tools/solutions.js [--world N] [--level wN-NN[,wN-NN...]] [--moving | --static] [--jobs J] [--budget SECONDS] [--gap STEPS] [--k0 STEPS] [--mgap STEPS] [--out FILE] [--seed FILE | --no-seed] [--rob-ok CELLS]
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const cp = require("child_process");
global.window = global;
const ROOT = path.join(__dirname, "..");
const Sim = require(path.join(ROOT, "js", "sim.js"));
const V = require("./verify-solutions.js");

const DEG = Math.PI / 180;
const DT = Sim.DT;
const KSTEP = 12;
const WIN = 240;
const MAXWIN = 6;
const HORIZON = 2;
const TRY = 6;
const TRY_POLLEN = 3;
const BRANCH = 3;
const BEAM = 10;
const PICK = 3;
const PICK_MOVING = 2;
const TCAP = 60;
const FA = 41, FP = 25, FDA = 0.1 * DEG, FDP = 0.005;
const TW = 5;
const TOL_OK = 60;
const GOOD = 800;
const NOW_EARLY = 12, NOW_LATE = 30;
const LATE_MS = 120000;
const GRIDS = {
  coarse: { da: 1.5, p0: 0.1, dp: 0.035 },
  fine: { da: 1, p0: 0.06, dp: 0.02 },
  finer: { da: 0.5, p0: 0.05, dp: 0.01 },
};

const args = process.argv.slice(2);
const opt = function (name, def) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const OUT = path.resolve(opt("--out", path.join(ROOT, "js", "solutions.js")));
const GAP = parseInt(opt("--gap", "12"), 10);
const BUDGET = parseFloat(opt("--budget", "600"));
const ROB_OK = parseFloat(opt("--rob-ok", "64"));
const TIERS = [
  { k0: parseInt(opt("--k0", "300"), 10), gap: parseInt(opt("--mgap", "150"), 10) },
  { k0: 180, gap: 120 },
  { k0: 60, gap: 60 },
];

function r6(x) { return Math.round(x * 1e6) / 1e6; }
function popcount(m) { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
function isMoving(lv) { return lv.bodies.some(function (b) { return b.orbit || (b.shield && b.shield.w); }); }

/** Builds the angle/power lattice for a grid spec. */
function makeGrid(spec) {
  const angs = [], pows = [];
  for (let d = -180; d < 180 - 1e-9; d += spec.da) angs.push(d * DEG);
  for (let p = spec.p0; p <= 1.0001; p += spec.dp) pows.push(Math.min(1, p));
  return { angs: angs, pows: pows, NA: angs.length, NP: pows.length };
}

/** Builds an allocation-free replica of Sim.simulateShot for one level, returning {b, m, n, x, y, type}. */
function makeFast(lv) {
  const B = lv.bodies, nb = B.length, W = Sim.WORLD, SR = Sim.SEED_R, wrap = Sim.wrapAngle;
  const mass = new Float64Array(nb), PX = new Float64Array(nb), PY = new Float64Array(nb);
  const kind = [], orb = [];
  const KIND = { fertile: 1, sun: 2, blackhole: 3, ice: 4 };
  for (let i = 0; i < nb; i++) {
    const b = B[i];
    mass[i] = Sim.massOf(b);
    kind.push(KIND[b.kind] || 0);
    orb.push(b.orbit ? { p: b.orbit.p != null ? b.orbit.p : -1, cx: b.orbit.cx, cy: b.orbit.cy, R: b.orbit.R, w: b.orbit.w, ph: b.orbit.ph } : null);
    if (!b.orbit) { PX[i] = b.x; PY[i] = b.y; }
  }
  const shields = [];
  for (let i = 0; i < nb; i++) if (B[i].shield) shields.push({ i: i, R: Sim.shieldRadius(B[i]), sh: B[i].shield });
  const winds = lv.winds || [], portals = lv.portals || [], boosts = lv.boosts || [], pollen = lv.pollen || [];
  const hasPortals = !!lv.portals, hasBoosts = !!lv.boosts, hasPollen = !!lv.pollen;
  const moving = orb.some(function (o) { return o; });
  const TYPES = ["plant", "burn", "swallow", "crash"];
  const got = [];
  const near = function (dx, dy, thr) {
    const q = dx * dx + dy * dy, hi = thr + 1e-7, lo = thr - 1e-7;
    if (q > hi * hi) return false;
    if (q < lo * lo) return true;
    return (Math.hypot(dx, dy) || 1) < thr;
  };
  return function (ang, pow, T0, maxT) {
    const sp = pow * Sim.MAX_SPEED;
    let x = lv.launch[0], y = lv.launch[1], vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp, t = 0, cool = 0, boostCool = 0;
    let T = T0, m = 0, type = null, hit = -1, n = 0;
    got.length = 0;
    for (let k = 0; k < pollen.length; k++) got.push(false);
    const steps = Math.round((maxT || Sim.FLIGHT_MAX) / DT) + 2, dt = DT;
    for (let st = 0; st < steps && type === null; st++) {
      T += DT;
      n++;
      if (moving) {
        for (let i = 0; i < nb; i++) {
          const o = orb[i];
          if (!o) continue;
          const c0 = o.p >= 0 ? PX[o.p] : o.cx, c1 = o.p >= 0 ? PY[o.p] : o.cy;
          const a = o.ph + o.w * T;
          PX[i] = c0 + Math.cos(a) * o.R; PY[i] = c1 + Math.sin(a) * o.R;
        }
      }
      let ax = 0, ay = 0;
      for (let i = 0; i < nb; i++) {
        const dx = PX[i] - x, dy = PY[i] - y;
        const d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
        const a = mass[i] / (d2 + 400);
        ax += a * dx / d; ay += a * dy / d;
      }
      for (let q = 0; q < winds.length; q++) {
        const w = winds[q];
        if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) { ax += w.ax; ay += w.ay; }
      }
      const px = x, py = y;
      vx += ax * dt; vy += ay * dt;
      x += vx * dt; y += vy * dt;
      t += dt;
      if (cool > 0) cool -= dt;
      if (boostCool > 0) boostCool -= dt;
      let ev = false;
      for (let q = 0; q < shields.length && !ev; q++) {
        const S = shields[q], i = S.i, R = S.R;
        if (near(px - PX[i], py - PY[i], R) !== near(x - PX[i], y - PY[i], R)) {
          const an = Math.atan2(y - PY[i], x - PX[i]);
          if (!(Math.abs(wrap(an - (S.sh.ph + (S.sh.w || 0) * T))) < S.sh.gap / 2)) { type = "shield"; hit = i; ev = true; }
        }
      }
      if (ev) break;
      for (let i = 0; i < nb && !ev; i++) {
        const b = B[i], dx = x - PX[i], dy = y - PY[i];
        if (near(dx, dy, b.r + SR)) {
          const d = Math.hypot(dx, dy) || 1;
          const nx = dx / d, ny = dy / d;
          if (kind[i] === 4) {
            const vn = vx * nx + vy * ny;
            if (vn < 0) { vx -= 1.85 * vn * nx; vy -= 1.85 * vn * ny; }
            x = PX[i] + nx * (b.r + SR + 0.5); y = PY[i] + ny * (b.r + SR + 0.5);
            ev = true;
          } else {
            type = TYPES[kind[i] ? kind[i] - 1 : 3]; hit = i; ev = true;
          }
        }
      }
      if (type !== null) break;
      if (ev) continue;
      if (cool <= 0 && hasPortals) {
        for (let k = 0; k < portals.length && !ev; k++) {
          const P = portals[k];
          for (let e = 0; e < 2; e++) {
            const from = e ? P.b : P.a, to = e ? P.a : P.b;
            if (near(x - from[0], y - from[1], Sim.PORTAL_R)) { x = to[0]; y = to[1]; cool = 0.5; ev = true; break; }
          }
        }
      }
      if (ev) continue;
      if (boostCool <= 0 && hasBoosts) {
        for (let k = 0; k < boosts.length; k++) {
          const g = boosts[k];
          if (near(x - g.x, y - g.y, Sim.BOOST_R)) {
            const spd = Math.hypot(vx, vy) * (g.mult != null ? g.mult : 1.4);
            const dir = g.ang != null ? g.ang : Math.atan2(vy, vx);
            vx = Math.cos(dir) * spd; vy = Math.sin(dir) * spd;
            x = g.x; y = g.y; boostCool = 0.35;
            ev = true; break;
          }
        }
      }
      if (ev) continue;
      if (hasPollen) {
        for (let k = 0; k < pollen.length; k++) {
          if (got[k]) continue;
          const q = pollen[k];
          if (near(x - q[0], y - q[1], Sim.POLLEN_R)) { got[k] = true; m |= 1 << k; ev = true; break; }
        }
      }
      if (ev) continue;
      if (x < -400 || x > W.w + 400 || y < -400 || y > W.h + 400 || t > Sim.FLIGHT_MAX) type = "lost";
    }
    return { b: type === "plant" ? hit : -1, m: m, n: n, x: x, y: y, type: type };
  };
}

/** Runs the reference simulator and reports the same fields as the fast replica. */
function slowShot(lv, np, a, p, T0, maxT) {
  const pg = [];
  for (let i = 0; i < np; i++) pg.push(false);
  const r = Sim.simulateShot(lv, a, p, T0, maxT, pg);
  let m = 0;
  for (let i = 0; i < np; i++) if (pg[i]) m |= 1 << i;
  return { b: r.end && r.end.type === "plant" ? r.end.i : -1, m: m, n: Math.round(r.seed.t / DT), x: r.seed.x, y: r.seed.y, type: r.end && Sim.TERMINAL[r.end.type] ? r.end.type : null };
}

/** Per-level search context with a shot cache and a self-tested fast simulator. */
function Ctx(lv) {
  this.lv = lv;
  this.need = lv.bodies.map(function (b) { return b.kind === "fertile" ? (b.need || 1) : 0; });
  this.np = (lv.pollen || []).length;
  this.full = (1 << this.np) - 1;
  this.cache = new Map();
  this.scans = new Map();
  this.sims = 0;
  const fast = makeFast(lv), np = this.np;
  let rnd = 12345;
  const rand = function () { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
  this.fastOk = true;
  for (let i = 0; i < 300 && this.fastOk; i++) {
    const a = (rand() * 2 - 1) * Math.PI, p = 0.05 + rand() * 0.95, k = Math.floor(rand() * 3000), mt = i % 2 ? 14 : 7;
    const f = fast(a, p, k * DT, mt), s = slowShot(lv, np, a, p, k * DT, mt);
    if (f.b !== s.b || f.m !== s.m || f.n !== s.n || f.x !== s.x || f.y !== s.y || f.type !== s.type) this.fastOk = false;
  }
  const lvr = lv;
  this.fire = this.fastOk ? function (a, p, k, maxT) { return fast(a, p, k * DT, maxT); } : function (a, p, k, maxT) { return slowShot(lvr, np, a, p, k * DT, maxT); };
}

/** Fires one seed from a clean pollen state and returns {b: planted body or -1, m: pollen mask, n: steps}. */
Ctx.prototype.shoot = function (a, p, k, maxT) {
  const key = a + "|" + p + "|" + k + "|" + maxT;
  const c = this.cache.get(key);
  if (c) return c;
  this.sims++;
  const r = this.fire(a, p, k, maxT);
  const out = { b: r.b, m: r.m, n: r.n };
  if (this.cache.size > 400000) this.cache.clear();
  this.cache.set(key, out);
  return out;
};

/** Scans the whole lattice at launch step k. */
Ctx.prototype.scan = function (G, gname, k, maxT) {
  const key = gname + "|" + k + "|" + maxT;
  const hit = this.scans.get(key);
  if (hit) return hit;
  const N = G.NA * G.NP, b = new Int8Array(N), m = new Uint8Array(N), n = new Uint16Array(N);
  for (let ai = 0; ai < G.NA; ai++) {
    for (let pi = 0; pi < G.NP; pi++) {
      const idx = ai * G.NP + pi;
      this.sims++;
      const r = this.fire(G.angs[ai], G.pows[pi], k, maxT);
      b[idx] = r.b; m[idx] = r.m; n[idx] = r.n;
    }
  }
  const s = { b: b, m: m, n: n };
  if (this.scans.size > 3000) this.scans.clear();
  this.scans.set(key, s);
  return s;
};

/** Launch steps [early, late] (up to TCAP each) the same aim may drift while still planting body b. */
Ctx.prototype.tol = function (a, p, k, maxT, b) {
  let lo = 0, hi = 0;
  for (let d = 1; d <= TCAP && k - d >= 0; d++) { if (this.shoot(a, p, k - d, maxT).b !== b) break; lo = d; }
  for (let d = 1; d <= TCAP; d++) { if (this.shoot(a, p, k + d, maxT).b !== b) break; hi = d; }
  return [lo, hi];
};

/** Cells of the fine window around (a, p) connected to it that still plant body b and gain the given pollen; quick uses the inner half window and scales up. */
Ctx.prototype.basin = function (a, p, k, maxT, b, gain, mask, quick) {
  const na = quick ? (FA + 1) / 2 : FA, np = quick ? (FP + 1) / 2 : FP, ca = (na - 1) / 2, cp = (np - 1) / 2;
  const seen = new Uint8Array(na * np), st = [ca * np + cp];
  let n = 0;
  while (st.length) {
    const c = st.pop();
    if (seen[c]) continue;
    seen[c] = 1;
    const i = Math.floor(c / np), j = c % np, pw = p + (j - cp) * FDP;
    if (pw < 0.05 || pw > 1) continue;
    const r = this.shoot(a + (i - ca) * FDA, pw, k, maxT);
    if (r.b !== b || ((r.m & ~mask) & gain) !== gain) continue;
    n++;
    if (i + 1 < na) st.push(c + np);
    if (i > 0) st.push(c - np);
    if (j + 1 < np) st.push(c + 1);
    if (j > 0) st.push(c - 1);
  }
  return quick ? Math.round(n * FA * FP / (na * np)) : n;
};

/** Log2 bucket of a robustness score; every score of at least ROB_OK shares the top bucket. */
function bucket(x) { return x >= ROB_OK ? 99 : Math.floor(Math.log2(Math.max(1, x))); }

/** Orders two candidate shots: robustness, then pollen-gain basin, then shorter flight. */
function beats(x, y) {
  if (!y) return true;
  if (x.rob !== y.rob) return x.rob > y.rob;
  if (x.gbasin !== y.gbasin) return x.gbasin > y.gbasin;
  return x.n < y.n;
}

/** Orders two finished plans: robustness bucket, then pollen, then exact robustness, then shorter demo. */
function prefer(f, g) {
  if (!g) return true;
  const bf = bucket(f.minRob), bg = bucket(g.minRob);
  if (bf !== bg) return bf > bg;
  if (f.r.pollenGot !== g.r.pollenGot) return f.r.pollenGot > g.r.pollenGot;
  if (f.minRob !== g.minRob) return f.minRob > g.minRob;
  if (f.sumRob !== g.sumRob) return f.sumRob > g.sumRob;
  return f.r.endStep < g.r.endStep;
}

/** True when a plan is robust and collects every pollen. */
function goodEnough(f) { return f && f.r.golden && f.minRob >= GOOD; }

/** Measures a shot; when timed, recentres its launch step inside its timing window and reports the window. */
function evalShot(ctx, a, p, k, maxT, b, gain, mask, timed, kMin, endBy, quick) {
  let r = ctx.shoot(a, p, k, maxT);
  if (r.b !== b || ((r.m & ~mask) & gain) !== gain) return null;
  let lo = 0, hi = 0;
  if (timed) {
    const t = ctx.tol(a, p, k, maxT, b), A = k - t[0], B = k + t[1];
    const k2 = Math.max(kMin, A + Math.round((B - A) * NOW_EARLY / (NOW_EARLY + NOW_LATE)));
    if (k2 !== k && k2 <= B) {
      const r2 = ctx.shoot(a, p, k2, maxT);
      if (r2.b === b && ((r2.m & ~mask) & gain) === gain && k2 + r2.n <= endBy) { k = k2; r = r2; }
    }
    lo = k - A; hi = B - k;
  }
  if (k + r.n > endBy) return null;
  const basin = ctx.basin(a, p, k, maxT, b, 0, mask, quick);
  const gb = gain && !quick ? ctx.basin(a, p, k, maxT, b, gain, mask) : basin;
  const tol = timed ? lo + hi + 1 : Infinity;
  return { a: a, p: p, k: k, b: b, gain: gain, n: r.n, basin: basin, gbasin: gb, tol: tol, rob: timed && tol < TOL_OK ? Math.min(basin, TW * tol) : basin };
}

/** Chebyshev depth of every cell inside its class blob on the lattice (angle wraps). */
function blobDepth(cls, NA, NP) {
  const N = NA * NP;
  let d = new Int16Array(N);
  for (let i = 0; i < N; i++) d[i] = cls[i] >= 0 ? 1 : 0;
  for (let r = 1; r < 60; r++) {
    const nd = d.slice();
    let ch = false;
    for (let ai = 0; ai < NA; ai++) {
      for (let pi = 0; pi < NP; pi++) {
        const i = ai * NP + pi;
        if (d[i] !== r) continue;
        let ok = pi > 0 && pi < NP - 1;
        for (let x = -1; x <= 1 && ok; x++) {
          const aj = (ai + x + NA) % NA;
          for (let y = -1; y <= 1 && ok; y++) {
            const j = aj * NP + pi + y;
            if (cls[j] !== cls[i] || d[j] < r) ok = false;
          }
        }
        if (ok) { nd[i] = r + 1; ch = true; }
      }
    }
    d = nd;
    if (!ch) break;
  }
  return d;
}

/** Groups scan cells into classes (body, pollen gain) valid for the given state. */
function classify(S, G, got, need, mask) {
  const N = G.NA * G.NP, cls = new Int32Array(N), groups = new Map();
  for (let i = 0; i < N; i++) {
    const b = S.b[i];
    if (b < 0 || got[b] >= need[b]) { cls[i] = -1; continue; }
    const gain = S.m[i] & ~mask;
    const key = b * 256 + gain;
    cls[i] = key;
    let g = groups.get(key);
    if (!g) { g = { key: key, b: b, gain: gain, cells: [], md: 0 }; groups.set(key, g); }
    g.cells.push(i);
  }
  return { cls: cls, groups: groups };
}

/** Picks the most robust of the deepest cells of a class. */
function pickRep(ctx, G, S, depth, g, k, maxT, mask, timed, kMin, endBy, pick, quick) {
  const cells = g.cells.slice().sort(function (x, y) { return depth[y] - depth[x] || S.n[x] - S.n[y]; }).slice(0, pick);
  let best = null;
  for (let c = 0; c < cells.length; c++) {
    const i = cells[c];
    const cand = evalShot(ctx, G.angs[Math.floor(i / G.NP)], G.pows[i % G.NP], k, maxT, g.b, g.gain, mask, timed, kMin, endBy, quick);
    if (cand && beats(cand, best)) best = cand;
  }
  return best;
}

/** Searches a fine local lattice around a shot for a more robust cell of the same class. */
function polish(ctx, shot, maxT, mask, kMin, endBy, timed) {
  shot = evalShot(ctx, shot.a, shot.p, shot.k, maxT, shot.b, shot.gain, mask, timed, kMin, endBy) || shot;
  if (shot.rob >= FA * FP && shot.gbasin >= FA * FP) return shot;
  const NA = 41, NP = 41, da = 0.125 * DEG, dp = 0.0025;
  const angs = [], pows = [];
  for (let i = 0; i < NA; i++) angs.push(shot.a + (i - 20) * da);
  for (let j = 0; j < NP; j++) pows.push(shot.p + (j - 20) * dp);
  const cls = new Int32Array(NA * NP), n = new Uint16Array(NA * NP);
  for (let i = 0; i < NA; i++) {
    for (let j = 0; j < NP; j++) {
      const idx = i * NP + j, p = pows[j];
      if (p < 0.05 || p > 1) { cls[idx] = -1; continue; }
      const r = ctx.shoot(angs[i], p, shot.k, maxT);
      n[idx] = r.n;
      cls[idx] = r.b === shot.b && ((r.m & ~mask) & shot.gain) === shot.gain && shot.k + r.n <= endBy ? 1 : -1;
    }
  }
  const d = blobDepth(cls, NA, NP);
  const order = [];
  for (let i = 0; i < NA * NP; i++) if (cls[i] > 0) order.push(i);
  order.sort(function (x, y) { return d[y] - d[x] || n[x] - n[y]; });
  let best = shot;
  for (let c = 0; c < Math.min(6, order.length); c++) {
    const i = order[c];
    const cand = evalShot(ctx, angs[Math.floor(i / NP)], pows[i % NP], shot.k, maxT, shot.b, shot.gain, mask, timed, kMin, endBy);
    if (cand && beats(cand, best)) best = cand;
  }
  return best;
}

/** Polishes every shot of a plan in order, keeping each flight resolved before the next launch. */
function polishPlan(ctx, plan, maxT, moving, gap, k0) {
  let mask = 0, kMin = k0 || 0;
  const out = [];
  for (let i = 0; i < plan.length; i++) {
    const endBy = moving && i + 1 < plan.length ? plan[i + 1].k - gap : Infinity;
    const s = polish(ctx, plan[i], maxT, moving ? mask : 0, moving ? kMin : 0, endBy, moving);
    out.push(s);
    mask |= s.gain;
    kMin = s.k + s.n + gap;
  }
  if (!moving) {
    let k = 0;
    out.forEach(function (s) { s.k = k; k += s.n + GAP; });
  }
  return out;
}

/** Rounds a planned sequence and replays it in both time modes. */
function finalize(lv, plan) {
  const shots = plan.map(function (s) { return [r6(s.a), r6(s.p), s.k]; });
  const c = V.checkEntry(lv, { shots: shots, stars: 0, golden: false });
  if (!c.r || !c.r.ok) return null;
  const entry = { shots: shots, stars: c.r.stars, golden: c.r.golden };
  const c2 = V.checkEntry(lv, entry);
  if (c2.errs.length) return null;
  const fl = c.r.flights;
  let minGap = Infinity;
  for (let i = 1; i < fl.length; i++) minGap = Math.min(minGap, fl[i].k - (fl[i - 1].k + fl[i - 1].steps));
  const min = function (f) { return plan.reduce(function (m, s) { return Math.min(m, f(s)); }, Infinity); };
  return {
    entry: entry, r: c.r, plan: plan, firstK: fl[0].k, minGap: minGap,
    minRob: min(function (s) { return s.rob; }), minBasin: min(function (s) { return s.basin; }), minTol: min(function (s) { return s.tol; }),
    sumRob: plan.reduce(function (m, s) { return m + s.rob; }, 0),
  };
}

/** Static levels: one lattice scan, then a pollen-cover DP over the par slots. */
function solveStatic(ctx, gname, maxT, deadline) {
  const lv = ctx.lv, G = makeGrid(GRIDS[gname]);
  const S = ctx.scan(G, gname, 0, maxT);
  const zero = ctx.need.map(function () { return 0; });
  const C = classify(S, G, zero, ctx.need, 0);
  const depth = blobDepth(C.cls, G.NA, G.NP);
  const byBody = {};
  C.groups.forEach(function (g) {
    if (Date.now() > deadline) return;
    const rep = pickRep(ctx, G, S, depth, g, 0, maxT, 0, false, 0, Infinity, PICK, false);
    if (rep) (byBody[g.b] = byBody[g.b] || []).push(rep);
  });
  const slots = [];
  ctx.need.forEach(function (n, i) { for (let j = 0; j < n; j++) slots.push(i); });
  let states = new Map([[0, { minR: Infinity, sumN: 0, picks: [] }]]);
  for (let s = 0; s < slots.length; s++) {
    const opts = byBody[slots[s]] || [];
    const next = new Map();
    states.forEach(function (st, u) {
      opts.forEach(function (o) {
        const nu = u | o.gain;
        const cand = { minR: Math.min(st.minR, o.rob), sumN: st.sumN + o.n + GAP, picks: st.picks.concat([o]) };
        const cur = next.get(nu);
        if (!cur || cand.minR > cur.minR || (cand.minR === cur.minR && cand.sumN < cur.sumN)) next.set(nu, cand);
      });
    });
    states = next;
  }
  let out = null;
  states.forEach(function (st) {
    const picks = st.picks.slice().sort(function (x, y) { return popcount(y.gain) - popcount(x.gain); });
    let k = 0;
    const plan = picks.map(function (o) { const s = Object.assign({}, o, { k: k }); k += o.n + GAP; return s; });
    const f0 = finalize(lv, plan);
    if (f0 && prefer(f0, out)) out = f0;
  });
  if (!out) return null;
  const f1 = finalize(lv, polishPlan(ctx, out.plan, maxT, false, GAP));
  return f1 && prefer(f1, out) ? f1 : out;
}

/** Scan at step k keeping only cells whose class holds at the stab neighbouring KSTEP lattice steps on each side. */
function stableScan(ctx, G, gname, k, maxT, stab) {
  const S0 = ctx.scan(G, gname, k, maxT);
  if (!stab) return S0;
  const key = "s" + stab + "|" + gname + "|" + k + "|" + maxT, hit = ctx.scans.get(key);
  if (hit) return hit;
  const b = S0.b.slice();
  for (let d = -stab; d <= stab; d++) {
    if (!d || k + d * KSTEP < 0) continue;
    const Sd = ctx.scan(G, gname, k + d * KSTEP, maxT);
    for (let i = 0; i < b.length; i++) if (Sd.b[i] !== S0.b[i] || Sd.m[i] !== S0.m[i]) b[i] = -1;
  }
  const s = { b: b, m: S0.m, n: S0.n };
  ctx.scans.set(key, s);
  return s;
}

/** Moving levels: beam search over shots, scanning launch steps on a KSTEP lattice. */
function solveMoving(ctx, gname, maxT, stab, tier, deadline) {
  const lv = ctx.lv, G = makeGrid(GRIDS[gname]), par = lv.par;
  const stateKey = function (s) { return s.mask + "|" + s.got.join(",") + "|" + s.plan.map(function (x) { return x.k; }).join(","); };
  function expand(state) {
    const pending = ctx.full & ~state.mask, k0 = Math.ceil(state.earliest / KSTEP) * KSTEP;
    const late = Date.now() > deadline, tries = late ? 2 : TRY, tryPol = late ? 1 : TRY_POLLEN;
    let reps = [];
    for (let wins = HORIZON; wins <= MAXWIN && !reps.length; wins += HORIZON) {
      const cands = [];
      for (let k = k0 + (wins - HORIZON) * WIN; k < k0 + wins * WIN && !(late && cands.length); k += KSTEP) {
        if (Date.now() > deadline + LATE_MS) return reps;
        const S = stableScan(ctx, G, gname, k, maxT, stab);
        const C = classify(S, G, state.got, ctx.need, state.mask);
        if (!C.groups.size) continue;
        const depth = blobDepth(C.cls, G.NA, G.NP);
        C.groups.forEach(function (g) {
          g.cells.forEach(function (i) { if (depth[i] > g.md) g.md = depth[i]; });
          cands.push({ k: k, g: g, S: S, depth: depth });
        });
      }
      const byDepth = cands.slice().sort(function (x, y) { return y.g.md - x.g.md || y.g.cells.length - x.g.cells.length || x.k - y.k; });
      const picked = [], perClass = {};
      const take = function (c) {
        if (picked.indexOf(c) >= 0 || (perClass[c.g.key] || 0) >= 2) return;
        perClass[c.g.key] = (perClass[c.g.key] || 0) + 1;
        picked.push(c);
      };
      byDepth.forEach(function (c) { if (picked.length < tries) take(c); });
      if (pending) {
        const byGain = byDepth.filter(function (c) { return c.g.gain; }).sort(function (x, y) { return popcount(y.g.gain) - popcount(x.g.gain) || y.g.md - x.g.md; });
        byGain.slice(0, tryPol).forEach(take);
      }
      picked.forEach(function (c) {
        if (Date.now() > deadline + LATE_MS) return;
        const rep = pickRep(ctx, G, c.S, c.depth, c.g, c.k, maxT, state.mask, true, state.earliest, Infinity, PICK_MOVING, true);
        if (rep) reps.push(rep);
      });
    }
    reps.sort(function (x, y) { return y.rob - x.rob || x.k - y.k; });
    const nb = late ? 1 : BRANCH, out = reps.slice(0, nb);
    if (pending) {
      reps.filter(function (r) { return r.gain; }).sort(function (x, y) { return popcount(y.gain) - popcount(x.gain) || y.rob - x.rob; })
        .slice(0, nb).forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); });
    }
    return out;
  }
  let beam = [{ got: ctx.need.map(function () { return 0; }), mask: 0, earliest: tier.k0, plan: [], minRob: Infinity }];
  for (let d = 0; d < par; d++) {
    const next = [], seen = {};
    beam.forEach(function (st) {
      expand(st).forEach(function (rep) {
        const got = st.got.slice();
        got[rep.b]++;
        const c = { got: got, mask: st.mask | rep.gain, earliest: rep.k + rep.n + tier.gap, plan: st.plan.concat([rep]), minRob: Math.min(st.minRob, rep.rob) };
        const key = stateKey(c);
        if (!seen[key]) { seen[key] = 1; next.push(c); }
      });
    });
    if (!next.length) return null;
    const byRob = next.slice().sort(function (x, y) { return bucket(y.minRob) - bucket(x.minRob) || popcount(y.mask) - popcount(x.mask) || y.minRob - x.minRob || x.earliest - y.earliest; });
    const byPol = next.slice().sort(function (x, y) { return popcount(y.mask) - popcount(x.mask) || y.minRob - x.minRob || x.earliest - y.earliest; });
    const width = Date.now() > deadline ? 2 : Math.max(3, Math.round(BEAM * 3 / Math.max(3, par)));
    beam = [];
    for (let i = 0; beam.length < width && (i < byRob.length || i < byPol.length); i++) {
      if (byRob[i] && beam.indexOf(byRob[i]) < 0) beam.push(byRob[i]);
      if (byPol[i] && beam.length < width && beam.indexOf(byPol[i]) < 0) beam.push(byPol[i]);
    }
  }
  const done = [];
  beam.forEach(function (st) { const f = finalize(lv, st.plan); if (f) done.push(f); });
  done.sort(function (x, y) { return prefer(x, y) ? -1 : prefer(y, x) ? 1 : 0; });
  let best = null;
  done.slice(0, 3).forEach(function (f) {
    const f1 = finalize(lv, polishPlan(ctx, f.plan, maxT, true, tier.gap, tier.k0)) || f;
    if (prefer(f1, best)) best = f1;
  });
  return best;
}

/** Rebuilds a stored solution as a plan, then recentres and polishes it; null if it no longer replays or breaks the tier. */
function seedPlan(ctx, entry, moving, tier) {
  const lv = ctx.lv, c = entry && V.checkEntry(lv, entry);
  if (!c || !c.r || !c.r.ok || c.r.used !== lv.par) return null;
  let mask = 0;
  const plan = entry.shots.map(function (sh) {
    const r = ctx.shoot(sh[0], sh[1], sh[2], Sim.FLIGHT_MAX), gain = r.m & ~mask;
    mask |= gain;
    return { a: sh[0], p: sh[1], k: sh[2], b: r.b, gain: gain, n: r.n, basin: 0, gbasin: 0, tol: 0, rob: 0 };
  });
  const f = finalize(lv, polishPlan(ctx, plan, Sim.FLIGHT_MAX, moving, moving ? tier.gap : GAP, moving ? tier.k0 : 0));
  if (!f || (moving && (f.firstK < tier.k0 || f.minGap < tier.gap))) return null;
  return f;
}

/** Solves one level through successive passes, relaxing launch timing tiers for moving levels only when needed. */
function solveLevel(lv, seed) {
  const t0 = Date.now(), deadline = t0 + BUDGET * 1000, ctx = new Ctx(lv);
  const moving = isMoving(lv);
  let best = seed ? seedPlan(ctx, seed, moving, TIERS[0]) : null, pass = best ? "seed" : "";
  if (process.env.SOLVE_DEBUG) console.error(lv.id, "seed", best ? "rob " + best.minRob + " basin " + best.minBasin + " tol " + best.minTol + " pollen " + best.r.pollenGot : "none");
  const passes = moving
    ? [["coarse", 7, 2, 0.35], ["coarse", 14, 1, 0.5], ["fine", 14, 0, 1]]
    : [["fine", 10, 0, 0.5], ["finer", 14, 0, 1]];
  const tiers = moving ? [[TIERS[0], 0.7], [TIERS[1], 0.5], [TIERS[2], 1]] : [[null, 1]];
  for (let ti = 0; ti < tiers.length; ti++) {
    if (best && (ti > 0 || goodEnough(best))) break;
    const tier = tiers[ti][0], tEnd = Math.min(deadline, Date.now() + tiers[ti][1] * BUDGET * 1000);
    for (let i = 0; i < passes.length; i++) {
      const P = passes[i], now = Date.now();
      if (now > tEnd) break;
      const dl = Math.min(tEnd, now + P[3] * (tEnd - now));
      const f = moving ? solveMoving(ctx, P[0], P[1], P[2], tier, dl) : solveStatic(ctx, P[0], P[1], dl);
      if (process.env.SOLVE_DEBUG) console.error(lv.id, P.join("/"), tier ? "t" + (ti + 1) : "", ((Date.now() - now) / 1000).toFixed(1) + "s", f ? "rob " + f.minRob + " basin " + f.minBasin + " tol " + f.minTol + " pollen " + f.r.pollenGot : "none");
      if (f && prefer(f, best)) { best = f; pass = P[0] + "/" + P[1] + (moving ? "/s" + P[2] : "") + "/p" + (i + 1) + (tier ? "/t" + (ti + 1) : ""); }
      if (goodEnough(best)) break;
    }
  }
  return {
    id: lv.id, entry: best ? best.entry : null, used: best ? best.r.used : 0, par: lv.par, stars: best ? best.r.stars : 0,
    golden: best ? best.r.golden : false, pollenGot: best ? best.r.pollenGot : 0, pollenTotal: ctx.np, endStep: best ? best.r.endStep : 0,
    rob: best ? best.minRob : -1, basin: best ? best.minBasin : -1, tm: best ? best.minTol : -1, firstK: best ? best.firstK : -1, minGap: best ? best.minGap : -1,
    moving: moving, fastOk: ctx.fastOk, pass: pass, sims: ctx.sims, ms: Date.now() - t0,
  };
}

function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }

/** Writes js/solutions.js with one level per line, sorted by id. */
function writeOut(all) {
  const ids = Object.keys(all).sort();
  const lines = ids.map(function (id) { return "  " + JSON.stringify(id) + ": " + JSON.stringify(all[id]) + ","; });
  const src = "window.ORCHARD_SOLUTIONS = Object.assign(window.ORCHARD_SOLUTIONS || {}, {\n" + lines.join("\n") + "\n});\n";
  fs.writeFileSync(OUT, src);
}

function worker() {
  const L = V.loadLevels(), seeds = args.indexOf("--no-seed") >= 0 ? {} : V.loadSolutions(opt("--seed", OUT));
  process.on("message", function (msg) {
    if (msg.id == null) { process.exit(0); return; }
    let res;
    try { res = solveLevel(L.levels.get(msg.id), seeds[msg.id]); } catch (e) { res = { id: msg.id, error: String(e && e.stack || e) }; }
    process.send(res);
  });
}

function main() {
  const t0 = Date.now();
  const world = opt("--world", null), only = opt("--level", null);
  const onlyMoving = args.indexOf("--moving") >= 0, onlyStatic = args.indexOf("--static") >= 0;
  const jobs = parseInt(opt("--jobs", String(Math.max(1, os.cpus().length - 2))), 10);
  const L = V.loadLevels();
  const ids = [];
  L.levels.forEach(function (lv, id) {
    if (world && id.indexOf("w" + world + "-") !== 0) return;
    if (only && only.split(",").indexOf(id) < 0) return;
    if (onlyMoving && !isMoving(lv)) return;
    if (onlyStatic && isMoving(lv)) return;
    ids.push(id);
  });
  if (!ids.length) { console.error("no levels match"); process.exit(2); }
  const weight = function (id) { const lv = L.levels.get(id); return (isMoving(lv) ? 1000 : 0) + lv.par * 50 + lv.bodies.length; };
  const queue = ids.slice().sort(function (a, b) { return weight(b) - weight(a); });
  const results = {};
  let running = 0;
  const n = Math.min(jobs, queue.length);
  console.log("solving " + ids.length + " level(s) with " + n + " worker(s), budget " + BUDGET + "s/level");
  function feed(w) {
    const id = queue.shift();
    if (id == null) { w.send({ id: null }); return; }
    w.send({ id: id });
  }
  for (let i = 0; i < n; i++) {
    const w = cp.fork(__filename, ["--worker"].concat(args));
    running++;
    w.on("message", function (res) {
      results[res.id] = res;
      const tag = res.error ? "ERROR" : !res.entry ? "NONE" : res.stars === 3 ? (res.golden ? "3*G" : "3*") : res.stars + "*";
      console.log("  done " + pad(res.id, 6) + " " + pad(tag, 5) + " " + ((res.ms || 0) / 1000).toFixed(1) + "s  (" + Object.keys(results).length + "/" + ids.length + ")");
      feed(w);
    });
    w.on("exit", function () { if (--running === 0) finish(); });
    feed(w);
  }
  function finish() {
    const merged = only || world || onlyMoving || onlyStatic ? V.loadSolutions(OUT) : {};
    ids.forEach(function (id) {
      const r = results[id];
      if (r && r.entry) merged[id] = r.entry;
      else delete merged[id];
    });
    writeOut(merged);
    console.log("\n" + pad("level", 7) + pad("type", 7) + pad("shots/par", 10) + pad("stars", 6) + pad("golden", 8) + pad("pollen", 8) + pad("robust", 7) + pad("basin", 6) + pad("tol", 5) + pad("k0", 6) + pad("gap", 6) + pad("demo s", 8) + pad("search s", 9) + "pass");
    let three = 0, gold = 0, fail = [], nog = [];
    ids.slice().sort().forEach(function (id) {
      const r = results[id] || { id: id, error: "worker died" };
      if (r.error || !r.entry) {
        fail.push(id);
        console.log(pad(id, 7) + "!!! NO SOLUTION " + (r.error || ""));
        return;
      }
      if (r.stars === 3) three++; else fail.push(id);
      if (r.golden) gold++; else nog.push(id);
      console.log(pad(id, 7) + pad(r.moving ? "moving" : "static", 7) + pad(r.used + "/" + r.par, 10) + pad(r.stars, 6) + pad(r.golden ? "yes" : "NO", 8) +
        pad(r.pollenGot + "/" + r.pollenTotal, 8) + pad(r.rob, 7) + pad(r.basin, 6) + pad(r.moving ? r.tm : "-", 5) + pad(r.firstK, 6) + pad(r.minGap === Infinity || r.minGap == null ? "-" : r.minGap, 6) + pad((r.endStep * DT).toFixed(2), 8) + pad((r.ms / 1000).toFixed(1), 9) + r.pass + (r.fastOk ? "" : " (reference sim)"));
    });
    console.log("\n" + ids.length + " level(s): 3-star " + three + ", golden " + gold + ", total time " + ((Date.now() - t0) / 1000).toFixed(1) + "s");
    if (nog.length) console.log("golden not found: " + nog.join(" "));
    if (fail.length) console.log("!!! PAR SOLUTION NOT FOUND: " + fail.join(" "));
    console.log("wrote " + path.relative(process.cwd(), OUT) + " (" + Object.keys(merged).length + " levels)");
    process.exit(fail.length ? 1 : 0);
  }
}

module.exports = { Ctx: Ctx, makeFast: makeFast, slowShot: slowShot, solveLevel: solveLevel, solveMoving: solveMoving, solveStatic: solveStatic, makeGrid: makeGrid, GRIDS: GRIDS, classify: classify, blobDepth: blobDepth, pickRep: pickRep, evalShot: evalShot };
if (args.indexOf("--worker") >= 0) worker();
else if (require.main === module) main();
