const E = require("./nodeenv.js"), G = E.O._debug.gen, Sim = E.Sim;
function mul(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rate(lv, n) { const r = mul(12345); let hit = 0; const L = Object.assign({ portals: [], winds: [], boosts: [], pollen: [] }, lv); for (let i = 0; i < n; i++) { const res = Sim.simulateShot(L, r() * 2 * Math.PI - Math.PI, 0.05 + r() * 0.95, r() * 10, 14, null); if (res.end && res.end.type === "plant") hit++; } return hit / n; }
const S = +(process.argv[2] || 30), N = +(process.argv[3] || 1000);
for (let d = 1; d <= 5; d++) {
  const ts = [], v = []; let fb = 0, outb = 0, nb = 0;
  for (let k = 0; k < S; k++) {
    const t0 = performance.now(), lv = E.O.generateLevel(20261012 + k * 101, { difficulty: d }); ts.push(performance.now() - t0);
    if (lv.bodies.length === 2 && lv.bodies[0].x === 780 && lv.launch[0] === 200) fb++; const bb = G.BANDS[d], est = G.shotRate(Object.assign({}, lv), mul(77), [0, 1], 1e9).p; if (est < bb[0] || est > bb[1]) nb++;
    const p = N ? rate(lv, N) : 0; v.push(p);
    const b = G.BANDS[d]; if (p < b[0] * 0.8 || p > b[1] * 1.25) outb++;
  }
  ts.sort((a, b) => a - b); v.sort((a, b) => a - b);
  console.log("d" + d, "time avg", (ts.reduce((a, b) => a + b) / S).toFixed(0), "p90", ts[Math.floor(S * 0.9)].toFixed(0), "max", ts[S - 1].toFixed(0), "ms | rate mean", (100 * v.reduce((a, b) => a + b) / S).toFixed(2) + "%", "p10/50/90", [0.1, 0.5, 0.9].map((q) => (100 * v[Math.floor(q * S)]).toFixed(1)).join("/"), "fallbacks", fb, "well-outside-band", outb, "est-outside", nb);
}
