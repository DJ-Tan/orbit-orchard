// Usage: node tools/verify-solutions.js [--world N] [--level wN-NN] [--quiet]
"use strict";
const path = require("path");
const fs = require("fs");
global.window = global;
const ROOT = path.join(__dirname, "..");
const Sim = require(path.join(ROOT, "js", "sim.js"));

/** Loads every world file and returns { worlds, levels: Map(id -> level) }. */
function loadLevels() {
  global.ORCHARD_WORLDS = [];
  for (let w = 1; w <= 5; w++) {
    const f = path.join(ROOT, "js", "levels", "w" + w + ".js");
    delete require.cache[require.resolve(f)];
    require(f);
  }
  const levels = new Map();
  global.ORCHARD_WORLDS.forEach(function (W) { W.levels.forEach(function (lv) { levels.set(lv.id, lv); }); });
  return { worlds: global.ORCHARD_WORLDS, levels: levels };
}

/** Loads js/solutions.js (or another file) into a plain object. */
function loadSolutions(file) {
  const f = file || path.join(ROOT, "js", "solutions.js");
  if (!fs.existsSync(f)) return {};
  const win = {};
  new Function("window", fs.readFileSync(f, "utf8"))(win);
  return win.ORCHARD_SOLUTIONS || {};
}

/** Flies one seed launched at step k; mode "sim" uses Sim.simulateShot, "exact" uses T = (k + j) * DT. */
function fly(lv, a, p, k, pollenGot, mode) {
  if (mode !== "exact") {
    const r = Sim.simulateShot(lv, a, p, k * Sim.DT, Sim.FLIGHT_MAX, pollenGot);
    return { end: r.end, steps: Math.round(r.seed.t / Sim.DT), events: r.events };
  }
  const s = Sim.newSeed(lv, a, p), events = [];
  const max = Math.round(Sim.FLIGHT_MAX / Sim.DT) + 2;
  let j = 0, end = null;
  while (j < max) {
    j++;
    const ev = Sim.stepSeed(lv, s, (k + j) * Sim.DT, Sim.DT, pollenGot);
    if (!ev) continue;
    events.push(ev);
    if (ev.type === "pollen" && pollenGot) pollenGot[ev.k] = true;
    if (Sim.TERMINAL[ev.type]) { end = ev; break; }
  }
  return { end: end, steps: j, events: events };
}

/** Replays a whole attempt with engine attempt rules and returns its outcome or the first error. */
function replay(lv, shots, mode) {
  const B = lv.bodies;
  const need = B.map(function (b) { return b.kind === "fertile" ? (b.need || 1) : 0; });
  const got = B.map(function () { return 0; });
  const pollen = (lv.pollen || []).map(function () { return false; });
  const seeds = lv.seeds != null ? lv.seeds : lv.par + 2;
  const allSown = function () { return got.every(function (g, i) { return g >= need[i]; }); };
  const out = { ok: false, err: null, used: 0, stars: 0, golden: false, pollenGot: 0, pollenTotal: pollen.length, endStep: 0, flights: [] };
  let ready = 0;
  for (let i = 0; i < shots.length; i++) {
    const a = shots[i][0], p = shots[i][1], k = shots[i][2];
    if (allSown()) { out.err = "shot " + i + ": level already won"; return out; }
    if (out.used >= seeds) { out.err = "shot " + i + ": out of seeds"; return out; }
    if (!(typeof a === "number" && isFinite(a))) { out.err = "shot " + i + ": bad angle"; return out; }
    if (!(p >= 0.05 && p <= 1)) { out.err = "shot " + i + ": power " + p + " outside [0.05, 1]"; return out; }
    if (!(Number.isInteger(k) && k >= ready)) { out.err = "shot " + i + ": k=" + k + " before previous seed resolved (ready at " + ready + ")"; return out; }
    out.used++;
    const r = fly(lv, a, p, k, pollen, mode);
    const e = r.end;
    out.flights.push({ k: k, steps: r.steps, end: e ? e.type : "none", i: e ? e.i : -1 });
    if (!e || e.type !== "plant") { out.err = "shot " + i + ": ended with " + (e ? e.type + (e.i != null ? " #" + e.i : "") : "no terminal event"); return out; }
    if (got[e.i] >= need[e.i]) { out.err = "shot " + i + ": planted on full body #" + e.i; return out; }
    got[e.i]++;
    ready = k + r.steps;
    out.endStep = ready;
  }
  if (!allSown()) { out.err = "sequence ends before every fertile body is full"; return out; }
  out.ok = true;
  const at = lv.stars || [lv.par, lv.par + 1];
  out.stars = out.used <= at[0] ? 3 : out.used <= at[1] ? 2 : 1;
  out.pollenGot = pollen.filter(Boolean).length;
  out.golden = out.pollenGot === pollen.length;
  return out;
}

/** Checks one solution entry against a level in both time modes. */
function checkEntry(lv, entry) {
  const errs = [];
  if (!entry || !Array.isArray(entry.shots)) return { errs: ["missing entry"], r: null };
  const r1 = replay(lv, entry.shots, "sim"), r2 = replay(lv, entry.shots, "exact");
  if (!r1.ok) errs.push("simulateShot replay: " + r1.err);
  if (!r2.ok) errs.push("exact-T replay: " + r2.err);
  if (r1.ok) {
    if (entry.stars !== r1.stars) errs.push("stars field " + entry.stars + " != replay " + r1.stars);
    if (entry.golden !== r1.golden) errs.push("golden field " + entry.golden + " != replay " + r1.golden);
  }
  if (r1.ok && r2.ok && (r1.golden !== r2.golden || r1.endStep !== r2.endStep)) errs.push("time modes disagree");
  return { errs: errs, r: r1 };
}

/** True when any body orbits or carries a rotating shield. */
function isMoving(lv) { return lv.bodies.some(function (b) { return b.orbit || (b.shield && b.shield.w); }); }

/** First launch step and smallest wait between a seed resolving and the next launch. */
function timing(r) {
  let gap = Infinity;
  for (let i = 1; i < r.flights.length; i++) gap = Math.min(gap, r.flights[i].k - (r.flights[i - 1].k + r.flights[i - 1].steps));
  return { k0: r.flights.length ? r.flights[0].k : -1, gap: gap };
}

function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }

function main() {
  const args = process.argv.slice(2);
  const opt = function (name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const world = opt("--world"), only = opt("--level"), quiet = args.indexOf("--quiet") >= 0;
  const minK0 = parseInt(opt("--k0") || "300", 10), minGap = parseInt(opt("--mgap") || "150", 10);
  let moving = 0, guideOk = 0;
  const relaxed = [];
  const L = loadLevels(), sols = loadSolutions(opt("--file"));
  let bad = 0, n = 0, three = 0, golden = 0, withPollen = 0, goldenPollen = 0;
  L.levels.forEach(function (lv, id) {
    if (world && id.indexOf("w" + world + "-") !== 0) return;
    if (only && id !== only) return;
    n++;
    const c = checkEntry(lv, sols[id]);
    const r = c.r;
    if (c.errs.length) bad++;
    if (r && r.ok && r.stars === 3) three++;
    if (r && r.ok && r.golden) golden++;
    if ((lv.pollen || []).length) { withPollen++; if (r && r.ok && r.golden) goldenPollen++; }
    let tinfo = "";
    if (isMoving(lv) && r && r.ok) {
      const t = timing(r);
      moving++;
      if (t.k0 >= minK0 && t.gap >= minGap) guideOk++;
      else relaxed.push(id);
      tinfo = "k0 " + t.k0 + " gap " + (t.gap === Infinity ? "-" : t.gap);
    }
    if (!quiet || c.errs.length) {
      const info = r && r.ok ? "used " + r.used + "/" + lv.par + " stars " + r.stars + " pollen " + r.pollenGot + "/" + r.pollenTotal + " end " + (r.endStep * Sim.DT).toFixed(2) + "s " + tinfo : "";
      console.log((c.errs.length ? "[FAIL] " : "[ok]   ") + pad(id, 7) + pad(info, 64) + c.errs.join("; "));
    }
  });
  Object.keys(sols).forEach(function (id) { if (!L.levels.has(id)) { bad++; console.log("[FAIL] " + id + " has a solution but no such level"); } });
  console.log("\n" + n + " levels checked: " + (n - bad) + " ok, " + bad + " failed; 3-star " + three + "/" + n + "; golden " + golden + "/" + n +
    " (" + goldenPollen + "/" + withPollen + " levels that have pollen)");
  console.log("moving levels with first k >= " + minK0 + " and gaps >= " + minGap + ": " + guideOk + "/" + moving + (relaxed.length ? "; relaxed timing: " + relaxed.join(" ") : ""));
  process.exit(bad ? 1 : 0);
}

module.exports = { loadLevels: loadLevels, loadSolutions: loadSolutions, fly: fly, replay: replay, checkEntry: checkEntry };
if (require.main === module) main();
