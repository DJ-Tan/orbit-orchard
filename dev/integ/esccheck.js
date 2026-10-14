const E = require("./nodeenv.js"), Sim = E.Sim, G = E.O._debug.gen;
function mul(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const norm = (l) => Object.assign({ portals: [], winds: [], boosts: [], pollen: [] }, JSON.parse(JSON.stringify(l)));
function fly(lv, a, p, T0, pg) {
  const s = Sim.newSeed(lv, a, p); let T = T0, trig = -1, end = null;
  for (let j = 0; j < 1700; j++) {
    T += Sim.DT;
    const ev = Sim.stepSeed(lv, s, T, Sim.DT, pg);
    if (ev) { if (ev.type === "pollen" && pg) pg[ev.k] = true; if (Sim.TERMINAL[ev.type]) { end = ev.type; return { end, trig, j }; } }
    else if (trig < 0 && (j & 7) === 7 && G.escaping(lv, s, T)) trig = j;
  }
  return { end, trig };
}
let newSteps = 0, long0 = 0, long1 = 0, bad = 0, trig = 0, lostN = 0, saved = 0, lostSteps = 0;
const levels = [];
E.W.forEach((w) => w.levels.forEach((l) => levels.push(norm(l))));
for (let d = 1; d <= 5; d++) for (let k = 0; k < 8; k++) levels.push(norm(E.O.generateLevel(500 + k, { difficulty: d, anyRate: true })));
const r = mul(7), N = +(process.argv[2] || 400);
for (const lv of levels) for (let i = 0; i < N; i++) {
  const f = fly(lv, r() * 6.2832 - 3.1416, 0.05 + r() * 0.95, r() * 10, lv.pollen.map(() => false));
  if (f.end === "lost") { lostN++; lostSteps += f.j; const nj = f.trig >= 0 ? f.trig : f.j; newSteps += nj; if (f.j * Sim.DT > 8) long0++; if (nj * Sim.DT > 8) long1++; }
  if (f.trig >= 0) { trig++; saved += f.j - f.trig; if (f.end !== "lost") { bad++; console.log("FALSE", lv.id, f); } }
}
console.log("shots", levels.length * N, "lost", lostN, "triggered", trig, "false positives", bad, "avg lost flight", (lostSteps / lostN * Sim.DT).toFixed(2) + "s ->", (newSteps / lostN * Sim.DT).toFixed(2) + "s; lost >8s:", long0, "->", long1, "avg saved on triggered", (saved / Math.max(1, trig) * Sim.DT).toFixed(2) + "s");
let solBad = 0, solN = 0;
E.W.forEach((w) => w.levels.forEach((l) => {
  const sol = E.SOL[l.id]; if (!sol) return; const lv = norm(l), pg = lv.pollen.map(() => false);
  sol.shots.forEach((sh) => { solN++; const f = fly(lv, sh[0], sh[1], sh[2] * Sim.DT, pg); if (f.trig >= 0) { solBad++; console.log("SOL trig", l.id, sh, f); } });
}));
console.log("solution shots", solN, "with early trigger", solBad);
