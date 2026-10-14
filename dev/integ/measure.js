const E = require("./nodeenv.js"), Sim = E.Sim;
function mul(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rate(lv, n, mode) {
  const r = mul(12345); let hit = 0;
  const L = Object.assign({ portals: [], winds: [], boosts: [], pollen: [] }, lv);
  for (let i = 0; i < n; i++) {
    const a = r() * 2 * Math.PI - Math.PI, p = 0.05 + r() * 0.95, T0 = mode === "t" ? r() * 10 : 0;
    const res = Sim.simulateShot(L, a, p, T0, 14, null);
    if (res.end && res.end.type === "plant") hit++;
  }
  return hit / n;
}
const mode = process.argv[2] || "0", N = +(process.argv[3] || 2000);
let all = [];
E.W.forEach((w) => { const v = w.levels.map((l) => rate(l, N, mode)); all = all.concat(v); v.sort((a,b)=>a-b); console.log("world", w.id, "med", (100*v[11]).toFixed(2), "mean", (100 * v.reduce((a, b) => a + b) / v.length).toFixed(2) + "%", "min", (100 * Math.min.apply(null, v)).toFixed(1), "max", (100 * Math.max.apply(null, v)).toFixed(1)); });
const S = +(process.argv[4] || 40);
for (const d of [1, 2, 3, 4, 5]) {
  let s = 0, t = 0, worst = 0, v = [];
  for (let k = 0; k < S; k++) { const t0 = performance.now(); const lv = E.O.generateLevel(1000 + k * 37, { difficulty: d }); const dt = performance.now() - t0; t += dt; worst = Math.max(worst, dt); v.push(rate(lv, N, mode)); }
  v.sort((a, b) => a - b);
  console.log("gen d" + d, "mean", (100 * v.reduce((a, b) => a + b) / v.length).toFixed(2) + "%", "p10", (100 * v[Math.floor(S * 0.1)]).toFixed(1), "p90", (100 * v[Math.floor(S * 0.9)]).toFixed(1), "gen avg", (t / S).toFixed(0) + "ms worst", worst.toFixed(0));
}
